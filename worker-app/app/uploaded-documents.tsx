// UPLOADED DOCUMENTS SCREEN - View all uploaded documents and their verification status
// Features: Display all uploaded documents (general + category-specific), view document status, view documents
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';

interface UploadedDocument {
  type: string;
  fileName: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  uploadedAt: string;
  category?: string;
  uri?: string;
}

export default function UploadedDocumentsScreen() {
  const { worker, updateWorker } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [viewDocument, setViewDocument] = useState<UploadedDocument | null>(null);
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [categoryVerificationDocs, setCategoryVerificationDocs] = useState<{
    [category: string]: {
      skillProof: string | null;
      experience: string | null;
    }
  }>({});
  const [categoryVerificationStatus, setCategoryVerificationStatus] = useState<{
    [category: string]: 'pending' | 'verified' | 'rejected';
  }>({});
  const [verificationStatus, setVerificationStatus] = useState<{
    profilePhoto: string;
    certificate: string;
    citizenship: string;
    license?: string;
    overall: string;
  }>({
    profilePhoto: 'pending',
    certificate: 'pending',
    citizenship: 'pending',
    license: 'pending',
    overall: 'pending',
  });

  useEffect(() => {
    if (worker?.id) {
      loadVerificationData();
      
      // Connect to socket for live updates
      const { socketService } = require('@/lib/SocketService');
      socketService.connect(worker.id, 'worker');
      
      // Listen for verification status updates
      const handleVerificationUpdate = (data: any) => {
        if (data.workerId === worker.id) {
          console.log('📢 Verification update received in uploaded-documents:', data);
          // Reload verification data
          setTimeout(() => {
            loadVerificationData();
          }, 1000);
        }
      };
      
      // Listen for category verification updates
      const handleCategoryVerificationUpdate = (data: any) => {
        if (data.workerId === worker.id) {
          console.log('📢 Category verification update received:', data);
          setCategoryVerificationStatus(prev => ({
            ...prev,
            [data.category]: data.status,
          }));
          // Reload verification data
          setTimeout(() => {
            loadVerificationData();
          }, 1000);
        }
      };
      
      socketService.on('document:verification:updated', handleVerificationUpdate);
      socketService.on('category:verification:updated', handleCategoryVerificationUpdate);
      socketService.on('category:verification:submitted', handleVerificationUpdate);
      socketService.on('document:verification:submitted', handleVerificationUpdate);
      
      return () => {
        socketService.off('document:verification:updated', handleVerificationUpdate);
        socketService.off('category:verification:updated', handleCategoryVerificationUpdate);
        socketService.off('category:verification:submitted', handleVerificationUpdate);
        socketService.off('document:verification:submitted', handleVerificationUpdate);
      };
    }
  }, [worker?.id]);

  const loadVerificationData = async () => {
    if (!worker?.id) {
      setLoading(false);
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/workers/${worker.id}`);
      
      if (response.ok) {
        const workerData = await response.json();
        
        // Load verification status
        if (workerData.verificationStatus) {
          setVerificationStatus({
            profilePhoto: workerData.verificationStatus.profilePhoto || 'pending',
            certificate: workerData.verificationStatus.certificate || 'pending',
            citizenship: workerData.verificationStatus.citizenship || 'pending',
            license: workerData.verificationStatus.license || 'pending',
            overall: workerData.verificationStatus.overall || 'pending',
          });
        }

        // Sync worker context so QR screen and profile see verified status instantly
        if (updateWorker && worker) {
          updateWorker({
            ...worker,
            verificationStatus: workerData.verificationStatus || worker.verificationStatus,
            categoryVerificationStatus: workerData.categoryVerificationStatus ?? worker.categoryVerificationStatus,
          } as any);
        }

        // Load service categories
        const categories = workerData.serviceCategories || [];
        setServiceCategories(categories);

        // Load category documents and status
        const categoryDocs: { [key: string]: { skillProof: string | null; experience: string | null } } = {};
        const categoryStatus: { [key: string]: 'pending' | 'verified' | 'rejected' } = {};
        
        categories.forEach((cat: string) => {
          categoryDocs[cat] = {
            skillProof: workerData.categoryDocuments?.[cat]?.skillProof || null,
            experience: workerData.categoryDocuments?.[cat]?.experience || null,
          };
          categoryStatus[cat] = workerData.categoryVerificationStatus?.[cat] || 'pending';
        });
        
        setCategoryVerificationDocs(categoryDocs);
        setCategoryVerificationStatus(categoryStatus);

        // Build uploaded documents list
        const docs: UploadedDocument[] = [];
        
        // General documents
        if (workerData.documents) {
          Object.entries(workerData.documents).forEach(([type, fileName]: [string, any]) => {
            if (fileName) {
              const status = workerData.verificationStatus?.[type] || 'pending';
              docs.push({
                type,
                fileName,
                status,
                rejectionReason: workerData.verificationNotes,
                uploadedAt: workerData.submittedAt || new Date().toISOString(),
                uri: `${apiUrl}/uploads/${fileName}`,
              });
            }
          });
        }
        
        // Category-specific documents
        if (workerData.categoryDocuments) {
          Object.entries(workerData.categoryDocuments).forEach(([category, catDocs]: [string, any]) => {
            if (catDocs.skillProof) {
              const status = workerData.categoryVerificationStatus?.[category] || 'pending';
              docs.push({
                type: 'serviceCertificate',
                fileName: catDocs.skillProof,
                status,
                uploadedAt: workerData.submittedAt || new Date().toISOString(),
                category,
                uri: `${apiUrl}/uploads/${catDocs.skillProof}`,
              });
            }
            // Handle experience certificate (can be single file or array)
            if (catDocs.experience) {
              const status = workerData.categoryVerificationStatus?.[category] || 'pending';
              if (Array.isArray(catDocs.experience)) {
                // Multiple experience certificate files
                catDocs.experience.forEach((fileName: string, index: number) => {
                  docs.push({
                    type: 'experienceCertificate',
                    fileName: fileName,
                    status,
                    uploadedAt: workerData.submittedAt || new Date().toISOString(),
                    category: `${category} (Image ${index + 1})`,
                    uri: `${apiUrl}/uploads/${fileName}`,
                  });
                });
              } else {
                // Single experience certificate file
                docs.push({
                  type: 'experienceCertificate',
                  fileName: catDocs.experience,
                  status,
                  uploadedAt: workerData.submittedAt || new Date().toISOString(),
                  category,
                  uri: `${apiUrl}/uploads/${catDocs.experience}`,
                });
              }
            }
          });
        }
        
        setUploadedDocuments(docs);
      }
    } catch (error) {
      console.error('Error loading verification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentIcon = (type: string) => {
    if (type.includes('Certificate')) {
      return 'document-text';
    } else if (type === 'profilePhoto') {
      return 'image';
    } else if (type === 'citizenship') {
      return 'card';
    } else if (type === 'license') {
      return 'car';
    }
    return 'document';
  };

  const getDocumentName = (type: string) => {
    const names: { [key: string]: string } = {
      profilePhoto: 'Profile Photo',
      certificate: 'Professional Certificate',
      citizenship: 'Citizenship Document',
      license: 'Driving License',
      serviceCertificate: 'Service Certificate',
      experienceCertificate: 'Experience Certificate',
    };
    return names[type] || type;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF7A2C" />
            <Text style={styles.loadingText}>Loading documents...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Group documents by category
  const generalDocs = uploadedDocuments.filter(doc => !doc.category);
  const categoryDocs: { [key: string]: UploadedDocument[] } = {};
  
  uploadedDocuments.forEach(doc => {
    if (doc.category) {
      // Extract base category name (remove "Image X" suffix if present)
      const baseCategory = doc.category.includes(' (Image') 
        ? doc.category.split(' (Image')[0]
        : doc.category;
      if (!categoryDocs[baseCategory]) {
        categoryDocs[baseCategory] = [];
      }
      categoryDocs[baseCategory].push(doc);
    }
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
        {/* Header - full-bleed on Android */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Uploaded Documents</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* General Documents */}
        {generalDocs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>General Documents</Text>
            {generalDocs.map((doc, index) => (
              <TouchableOpacity
                key={index}
                style={styles.uploadedDocCard}
                onPress={() => setViewDocument(doc)}
              >
                <View style={styles.uploadedDocContent}>
                  <Ionicons 
                    name={getDocumentIcon(doc.type) as any} 
                    size={24} 
                    color="#FF7A2C" 
                  />
                  <View style={styles.uploadedDocInfo}>
                    <Text style={styles.uploadedDocName}>{getDocumentName(doc.type)}</Text>
                    <Text style={styles.uploadedDocDate}>
                      Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.statusBadge,
                  doc.status === 'verified' && styles.statusBadgeVerified,
                  doc.status === 'rejected' && styles.statusBadgeRejected,
                  doc.status === 'pending' && styles.statusBadgePending,
                ]}>
                  <Text style={styles.statusText}>
                    {doc.status === 'verified' ? 'Verified' : 
                     doc.status === 'rejected' ? 'Rejected' : 'Pending'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Category Documents - Organized by Category */}
        {Object.entries(categoryDocs).map(([category, docs]) => {
          const categoryStatus = categoryVerificationStatus[category] || 'pending';
          return (
            <View key={category} style={styles.section}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryHeaderLeft}>
                  <Ionicons name="briefcase" size={20} color="#FF7A2C" />
                  <Text style={styles.sectionTitle}>{category}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  categoryStatus === 'verified' && styles.statusBadgeVerified,
                  categoryStatus === 'rejected' && styles.statusBadgeRejected,
                  categoryStatus === 'pending' && styles.statusBadgePending,
                ]}>
                  <Text style={styles.statusText}>
                    {categoryStatus === 'verified' ? 'Verified' : 
                     categoryStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                  </Text>
                </View>
              </View>
              {docs.map((doc, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.uploadedDocCard}
                  onPress={() => setViewDocument(doc)}
                >
                  <View style={styles.uploadedDocContent}>
                    <Ionicons 
                      name={getDocumentIcon(doc.type) as any} 
                      size={24} 
                      color="#FF7A2C" 
                    />
                    <View style={styles.uploadedDocInfo}>
                      <Text style={styles.uploadedDocName}>{getDocumentName(doc.type)}</Text>
                      <Text style={styles.uploadedDocDate}>
                        Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {/* Empty State */}
        {uploadedDocuments.length === 0 && (
          <View style={styles.noDocumentsContainer}>
            <Ionicons name="document-outline" size={48} color="#ccc" />
            <Text style={styles.noDocumentsText}>No documents uploaded yet</Text>
            <Text style={styles.noDocumentsSubtext}>
              Upload documents using the "Verify Now" button in your profile
            </Text>
          </View>
        )}
        </ScrollView>
      </SafeAreaView>

      {/* Document View Modal */}
      <Modal
        visible={viewDocument !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewDocument(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {viewDocument ? getDocumentName(viewDocument.type) : ''}
              </Text>
              <TouchableOpacity onPress={() => setViewDocument(null)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {viewDocument && (
              <ScrollView style={styles.modalBody}>
                {viewDocument.uri && (
                  <Image
                    source={{ uri: viewDocument.uri }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                )}
                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoText}>
                    Status: {viewDocument.status === 'verified' ? 'Verified' : 
                            viewDocument.status === 'rejected' ? 'Rejected' : 'Pending Review'}
                  </Text>
                  {viewDocument.rejectionReason && (
                    <Text style={styles.rejectionReason}>
                      Rejection Reason: {viewDocument.rejectionReason}
                    </Text>
                  )}
                  <Text style={styles.modalInfoText}>
                    Uploaded: {new Date(viewDocument.uploadedAt).toLocaleDateString()}
                  </Text>
                  {viewDocument.category && (
                    <Text style={styles.modalInfoText}>
                      Category: {viewDocument.category}
                    </Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safe: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#FF7A2C',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    marginBottom: 80,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  uploadedDocCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  uploadedDocContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  uploadedDocInfo: {
    flex: 1,
  },
  uploadedDocName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  uploadedDocDate: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeVerified: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  noDocumentsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  noDocumentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  noDocumentsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  modalImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  modalInfo: {
    marginTop: 16,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  rejectionReason: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 8,
  },
});
