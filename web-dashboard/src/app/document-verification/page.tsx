// DOCUMENT VERIFICATION PAGE - Admin tool to verify worker documents by service category
// Features: View uploaded documents by category, approve/reject category verification, PDF/image viewing, Socket.IO real-time updates
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { socketService } from '../../lib/socketService';

interface CategoryDocuments {
  skillProof?: string;
  experience?: string;
}

interface Worker {
  _id: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  serviceCategories: string[];
  documents?: {
    profilePhoto?: string;
    certificate?: string;
    citizenship?: string;
    license?: string;
  };
  categoryDocuments?: {
    [category: string]: CategoryDocuments;
  };
  verificationStatus?: {
    profilePhoto?: 'pending' | 'verified' | 'rejected';
    certificate?: 'pending' | 'verified' | 'rejected';
    citizenship?: 'pending' | 'verified' | 'rejected';
    license?: 'pending' | 'verified' | 'rejected';
    overall?: 'pending' | 'verified' | 'rejected';
  } | string;
  categoryVerificationStatus?: {
    [category: string]: 'pending' | 'verified' | 'rejected';
  };
  verificationNotes?: string;
  verificationSubmitted?: boolean;
  submittedAt?: string;
  createdAt?: string;
  profileImage?: string;
  rating: number;
  completedJobs: number;
  experience?: string;
}

interface CategoryVerificationData {
  category: string;
  documents: {
    drivingLicense?: string;
    citizenship?: string;
    serviceCertificate?: string;
    experienceCertificate?: string;
  };
  status: 'pending' | 'verified' | 'rejected';
}

export default function DocumentVerificationPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<{ url: string; type: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [rejectionReason, setRejectionReason] = useState<string>('');

  useEffect(() => {
    const adminData = localStorage.getItem('adminUser');
    if (!adminData) {
      router.push('/auth');
      return;
    }

    let parsedAdmin: any;
    try {
      parsedAdmin = JSON.parse(adminData);
      setAdmin(parsedAdmin);
    } catch {
      router.push('/auth');
      return;
    }

    fetchWorkers();
    
    // Connect to Socket.IO for real-time document submission updates
    const adminId = parsedAdmin._id || parsedAdmin.id || 'admin-' + Date.now();
    socketService.connect(adminId, 'admin');

    // Listen for category verification submissions
    const handleCategorySubmitted = (data: any) => {
      console.log('📢 New category verification submission received:', data);
      // Refresh workers immediately to show new submission
      setTimeout(() => {
        fetchWorkers();
      }, 500);
    };

    // Listen for document verification submissions (legacy)
    const handleDocumentSubmitted = (worker: any) => {
      console.log('📢 New document submission received:', worker);
      // Refresh workers immediately to show new submission
      setTimeout(() => {
        fetchWorkers();
      }, 500);
    };

    // Listen for verification status updates (when admin approves/rejects)
    const handleVerificationUpdated = (data: any) => {
      console.log('📢 Verification status updated:', data);
      // Refresh workers to show updated status
      setTimeout(() => {
        fetchWorkers();
      }, 500);
    };

    // Wait a bit for connection to establish
    const connectTimeout = setTimeout(() => {
      // Listen for new submissions
      socketService.on('category:verification:submitted', handleCategorySubmitted);
      socketService.on('document:verification:submitted', handleDocumentSubmitted);
      
      // Listen for status updates
      socketService.on('category:verification:updated', handleVerificationUpdated);
      socketService.on('document:verification:updated', handleVerificationUpdated);
      
      // Listen for notifications
      socketService.on('notification:new', (notification: any) => {
        console.log('📢 New notification received:', notification);
        if (notification.type === 'category_verification_submitted') {
          handleCategorySubmitted(notification.data);
        }
      });
      
      console.log('✅ Socket.IO listeners registered for document verification');
    }, 1000);
    
    // Auto-refresh every 30 seconds to get new workers (as backup)
    const interval = setInterval(() => {
      fetchWorkers();
    }, 30000);

    return () => {
      clearTimeout(connectTimeout);
      clearInterval(interval);
      socketService.off('category:verification:submitted', handleCategorySubmitted);
      socketService.off('document:verification:submitted', handleDocumentSubmitted);
      socketService.off('category:verification:updated', handleVerificationUpdated);
      socketService.off('document:verification:updated', handleVerificationUpdated);
      socketService.off('notification:new');
    };
  }, [router]);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/admin/workers`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workers: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log('📊 Workers fetched from backend:', data.length);
      
      // Filter workers who have submitted documents for verification
      const filteredWorkers = data.filter((worker: Worker) => {
        // Check if worker has category documents
        const hasCategoryDocs = worker.categoryDocuments && 
          Object.keys(worker.categoryDocuments).length > 0 &&
          Object.values(worker.categoryDocuments).some(catDocs => 
            catDocs.skillProof || catDocs.experience
          );
        
        // Check if worker has general documents
        const hasGeneralDocs = worker.documents && 
          Object.values(worker.documents).some(doc => doc && doc !== '');
        
        // Check if verification was submitted
        const hasSubmitted = worker.verificationSubmitted === true;
        
        return hasCategoryDocs || (hasGeneralDocs && hasSubmitted);
      });
      
      console.log(`✅ Filtered workers with documents: ${filteredWorkers.length} out of ${data.length}`);
      
      setWorkers(filteredWorkers);
    } catch (error) {
      console.error('Error fetching workers:', error);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  // Get all categories that need verification for a worker
  const getCategoriesNeedingVerification = (worker: Worker): CategoryVerificationData[] => {
    const categories: CategoryVerificationData[] = [];
    
    // If worker has serviceCategories, use them
    const categoriesToCheck = worker.serviceCategories && worker.serviceCategories.length > 0
      ? worker.serviceCategories
      : (worker.categoryDocuments ? Object.keys(worker.categoryDocuments) : []);
    
    if (categoriesToCheck.length === 0) {
      return categories;
    }

    categoriesToCheck.forEach(category => {
      const catDocs = worker.categoryDocuments?.[category];
      const status = worker.categoryVerificationStatus?.[category] || 'pending';
      
      // Get documents from categoryDocuments (skillProof, experience)
      // Also check general documents for citizenship and license
      // Handle experience as array or single value
      const experienceValue = catDocs?.experience;
      const experienceCertificate = Array.isArray(experienceValue) 
        ? experienceValue[0] // Use first file if array
        : experienceValue;   // Use single value
      
      const documents = {
        serviceCertificate: catDocs?.skillProof,
        experienceCertificate: experienceCertificate,
        citizenship: worker.documents?.citizenship,
        drivingLicense: worker.documents?.license,
      };

      // Include category if it has documents OR if it has a status (to show verified/rejected categories)
      if (documents.serviceCertificate || documents.experienceCertificate || 
          documents.citizenship || documents.drivingLicense ||
          status === 'verified' || status === 'rejected') {
        categories.push({
          category,
          documents,
          status: status as 'pending' | 'verified' | 'rejected',
        });
      }
    });

    return categories;
  };

  // Get overall status for a worker (based on categories)
  const getOverallStatus = (worker: Worker): 'pending' | 'verified' | 'rejected' => {
    const categories = getCategoriesNeedingVerification(worker);
    
    if (categories.length === 0) {
      // Fallback to old verification status
      if (typeof worker.verificationStatus === 'string') {
        return worker.verificationStatus as 'pending' | 'verified' | 'rejected';
      }
      const status = worker.verificationStatus as any;
      return status?.overall || 'pending';
    }

    const statuses = categories.map(cat => cat.status);
    if (statuses.every(s => s === 'verified')) return 'verified';
    if (statuses.some(s => s === 'rejected')) return 'rejected';
    return 'pending';
  };

  const getStatusIcon = (status?: string) => {
    if (!status) return <span className="w-4 h-4 text-gray-500">?</span>;
    switch (status) {
      case 'verified': return <span className="w-4 h-4 text-green-500">✓</span>;
      case 'rejected': return <span className="w-4 h-4 text-red-500">✗</span>;
      case 'pending': return <span className="w-4 h-4 text-yellow-500">⏱</span>;
      default: return <span className="w-4 h-4 text-gray-500">?</span>;
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredWorkers = workers.filter(worker => {
    if (filter === 'all') return true;
    const overallStatus = getOverallStatus(worker);
    return overallStatus === filter;
  });

  const handleVerifyCategory = async (workerId: string, category: string, status: 'verified' | 'rejected') => {
    try {
      if (status === 'rejected' && !rejectionReason.trim()) {
        alert('Please provide a reason for rejection');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/admin/verify-category`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId,
          category,
          status,
          rejectionReason: status === 'rejected' ? rejectionReason : undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Category verification successful:', result);

        // When approving, also update general document verification (profilePhoto, certificate, citizenship, license)
        // so worker app shows "Verified" for all documents and QR can be generated
        if (status === 'verified') {
          const documentTypes = ['profilePhoto', 'certificate', 'citizenship', 'license'];
          for (const docType of documentTypes) {
            try {
              await fetch(`${apiUrl}/api/admin/verify-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workerId, documentType: docType, status: 'verified' }),
              });
            } catch (e) {
              console.warn(`Verify general doc ${docType}:`, e);
            }
          }
        }
        
        // Refresh workers to get updated status
        await fetchWorkers();
        
        // Update selected worker if it's the one being verified
        if (selectedWorker?._id === workerId) {
          // Fetch fresh worker data
          const workerResponse = await fetch(`${apiUrl}/api/admin/workers`);
          if (workerResponse.ok) {
            const allWorkers = await workerResponse.json();
            const updatedWorker = allWorkers.find((w: any) => w._id === workerId);
            if (updatedWorker) {
              setSelectedWorker(updatedWorker);
              setSelectedCategory(null);
              setRejectionReason('');
            }
          }
        }
        
        alert(`Category ${category} ${status === 'verified' ? 'approved' : 'rejected'} successfully!`);
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to verify category');
      }
    } catch (error) {
      console.error('Error verifying category:', error);
      alert('Failed to verify category. Please try again.');
    }
  };

  // Check if a file is a PDF
  const isPDF = (url: string): boolean => {
    return url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf');
  };

  // Get document URL with proper path
  const getDocumentUrl = (filename: string | undefined | string[]): string | null => {
    if (!filename) return null;
    // Handle array (for experience certificate)
    const file = Array.isArray(filename) ? filename[0] : filename;
    if (!file) return null;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    if (typeof file === 'string' && file.startsWith('http')) return file;
    if (typeof file === 'string') return `${apiUrl}/uploads/${file}`;
    return null;
  };

  const DocumentViewer = ({ documentUrl, documentType, documentName }: { 
    documentUrl: string; 
    documentType: string;
    documentName: string;
  }) => {
    const isPdf = isPDF(documentUrl);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-6xl max-h-[95vh] overflow-auto w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold capitalize">
              {documentType.replace(/([A-Z])/g, ' $1')} - {documentName}
            </h3>
            <button 
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={() => setSelectedDocument(null)}
            >
              Close
            </button>
          </div>
          <div className="relative w-full" style={{ minHeight: '500px' }}>
            {isPdf ? (
              <iframe
                src={documentUrl}
                className="w-full"
                style={{ height: '80vh', border: 'none' }}
                title={documentName}
              />
            ) : (
              <Image
                src={documentUrl}
                alt={documentType}
                width={1200}
                height={800}
                className="rounded-lg w-full"
                style={{ objectFit: 'contain' }}
                unoptimized
              />
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={() => window.open(documentUrl, '_blank')}
            >
              📥 Download / Open in New Tab
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Document Verification</h1>
        <p className="text-gray-600 mt-2">
          Review and verify worker documents by service category ({workers.length} workers submitted)
        </p>
      </div>

      <div className="w-full">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
          {[
            { key: 'all', label: 'All', count: workers.length },
            { key: 'pending', label: 'Pending', count: workers.filter(w => getOverallStatus(w) === 'pending').length },
            { key: 'verified', label: 'Verified', count: workers.filter(w => getOverallStatus(w) === 'verified').length },
            { key: 'rejected', label: 'Rejected', count: workers.filter(w => getOverallStatus(w) === 'rejected').length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredWorkers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {filter === 'all' 
                  ? 'No workers have submitted documents for verification yet.' 
                  : `No ${filter} verifications at the moment.`}
              </p>
            </div>
          ) : (
            filteredWorkers.map((worker) => {
              const overallStatus = getOverallStatus(worker);
              const categories = getCategoriesNeedingVerification(worker);
              
              return (
                <div key={worker._id} className="bg-white rounded-lg shadow-sm border p-6 cursor-pointer hover:shadow-md transition-shadow">
                  <div onClick={() => setSelectedWorker(worker)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center overflow-hidden">
                          {worker.profileImage ? (
                            <img src={worker.profileImage} alt={worker.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-orange-600 text-xl">
                              {worker.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{worker.name}</h3>
                          <p className="text-sm text-gray-600">{worker.email}</p>
                          <p className="text-xs text-gray-500">
                            Categories: {categories.length} | 
                            Submitted: {worker.submittedAt ? new Date(worker.submittedAt).toLocaleDateString() : 
                                       worker.createdAt ? new Date(worker.createdAt).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(overallStatus)}`}>
                          {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}
                        </span>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Worker Detail Modal */}
      {selectedWorker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-6xl max-h-[95vh] overflow-auto w-full my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Worker Verification Details</h2>
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                onClick={() => {
                  setSelectedWorker(null);
                  setSelectedCategory(null);
                  setRejectionReason('');
                }}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Worker Info */}
              <div className="bg-gray-50 rounded-lg border p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <span className="mr-2">👤</span>
                    Worker Information
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <span className="mr-2 text-gray-500">📧</span>
                    <span>{selectedWorker.email}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2 text-gray-500">📞</span>
                    <span>{selectedWorker.phone}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2 text-gray-500">⭐</span>
                    <span>Rating: {selectedWorker.rating || 0}/5 ({selectedWorker.completedJobs || 0} jobs)</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Service Categories:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedWorker.serviceCategories && selectedWorker.serviceCategories.length > 0 ? (
                        selectedWorker.serviceCategories.map((category, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-sm">
                            {category}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 text-sm">No categories listed</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* General Documents (if any) */}
              {selectedWorker.documents && Object.keys(selectedWorker.documents).length > 0 && (
                <div className="bg-gray-50 rounded-lg border p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold flex items-center">
                      <span className="mr-2">📄</span>
                      General Documents
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(selectedWorker.documents).map(([docType, docUrl]) => {
                      if (!docUrl) return null;
                      const fullUrl = getDocumentUrl(docUrl);
                      if (!fullUrl) return null;
                      
                      return (
                        <div key={docType} className="border rounded-lg p-3 bg-white">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium capitalize text-sm">
                              {docType.replace(/([A-Z])/g, ' $1')}
                            </h4>
                            <button 
                              className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
                              onClick={() => setSelectedDocument({ 
                                url: fullUrl, 
                                type: docType,
                                name: docUrl 
                              })}
                            >
                              👁 View
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Category-Based Documents */}
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <span className="mr-2">📋</span>
                Service Category Documents
              </h3>
              
              {getCategoriesNeedingVerification(selectedWorker).length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <span className="text-4xl mb-2 block">📄</span>
                  <p>No category documents uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getCategoriesNeedingVerification(selectedWorker).map((catData) => {
                    const isSelected = selectedCategory === catData.category;
                    const docs = catData.documents;
                    
                    return (
                      <div key={catData.category} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <h4 className="text-lg font-semibold capitalize">
                              {catData.category}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(catData.status)}`}>
                              {catData.status}
                            </span>
                          </div>
                          <button
                            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                            onClick={() => setSelectedCategory(isSelected ? null : catData.category)}
                          >
                            {isSelected ? '▼ Hide' : '▶ Show'} Documents
                          </button>
                        </div>

                        {isSelected && (
                          <div className="mt-4 space-y-3 bg-white p-4 rounded-lg">
                            {/* Citizenship */}
                            {docs.citizenship && (
                              <div className="border rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium text-sm">Citizenship Document</h5>
                                  <button 
                                    className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
                                    onClick={() => {
                                      const url = getDocumentUrl(docs.citizenship!);
                                      if (url) setSelectedDocument({ url, type: 'citizenship', name: docs.citizenship! });
                                    }}
                                  >
                                    👁 View
                                  </button>
                                </div>
                                {!isPDF(docs.citizenship) && getDocumentUrl(docs.citizenship) && (
                                  <div className="mt-2">
                                    <img 
                                      src={getDocumentUrl(docs.citizenship)!} 
                                      alt="Citizenship" 
                                      className="w-full h-32 object-cover rounded border"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Driving License */}
                            {docs.drivingLicense && (
                              <div className="border rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium text-sm">Driving License</h5>
                                  <button 
                                    className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
                                    onClick={() => {
                                      const url = getDocumentUrl(docs.drivingLicense!);
                                      if (url) setSelectedDocument({ url, type: 'drivingLicense', name: docs.drivingLicense! });
                                    }}
                                  >
                                    👁 View
                                  </button>
                                </div>
                                {!isPDF(docs.drivingLicense) && getDocumentUrl(docs.drivingLicense) && (
                                  <div className="mt-2">
                                    <img 
                                      src={getDocumentUrl(docs.drivingLicense)!} 
                                      alt="Driving License" 
                                      className="w-full h-32 object-cover rounded border"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Service Certificate */}
                            {docs.serviceCertificate && (
                              <div className="border rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium text-sm">Service Certificate</h5>
                                  <button 
                                    className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
                                    onClick={() => {
                                      const url = getDocumentUrl(docs.serviceCertificate!);
                                      if (url) setSelectedDocument({ url, type: 'serviceCertificate', name: docs.serviceCertificate! });
                                    }}
                                  >
                                    👁 View
                                  </button>
                                </div>
                                {!isPDF(docs.serviceCertificate) && getDocumentUrl(docs.serviceCertificate) && (
                                  <div className="mt-2">
                                    <img 
                                      src={getDocumentUrl(docs.serviceCertificate)!} 
                                      alt="Service Certificate" 
                                      className="w-full h-32 object-cover rounded border"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}
                                {isPDF(docs.serviceCertificate) && (
                                  <div className="mt-2 p-2 bg-gray-100 rounded border flex items-center gap-2">
                                    <span className="text-2xl">📄</span>
                                    <span className="text-sm text-gray-600">PDF Document</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Experience Certificate */}
                            {docs.experienceCertificate && (
                              <div className="border rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium text-sm">Experience Certificate</h5>
                                  <button 
                                    className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
                                    onClick={() => {
                                      const url = getDocumentUrl(docs.experienceCertificate!);
                                      if (url) setSelectedDocument({ url, type: 'experienceCertificate', name: docs.experienceCertificate! });
                                    }}
                                  >
                                    👁 View
                                  </button>
                                </div>
                                {!isPDF(docs.experienceCertificate) && getDocumentUrl(docs.experienceCertificate) && (
                                  <div className="mt-2">
                                    <img 
                                      src={getDocumentUrl(docs.experienceCertificate)!} 
                                      alt="Experience Certificate" 
                                      className="w-full h-32 object-cover rounded border"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}
                                {isPDF(docs.experienceCertificate) && (
                                  <div className="mt-2 p-2 bg-gray-100 rounded border flex items-center gap-2">
                                    <span className="text-2xl">📄</span>
                                    <span className="text-sm text-gray-600">PDF Document</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Verification Actions */}
                            {catData.status === 'pending' && (
                              <div className="mt-4 pt-4 border-t">
                                <div className="mb-3">
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Rejection Reason (if rejecting):
                                  </label>
                                  <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    rows={3}
                                    placeholder="Enter reason for rejection..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                    onClick={() => handleVerifyCategory(selectedWorker._id, catData.category, 'verified')}
                                  >
                                    ✓ Approve Category
                                  </button>
                                  <button 
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                                    onClick={() => handleVerifyCategory(selectedWorker._id, catData.category, 'rejected')}
                                  >
                                    ✗ Reject Category
                                  </button>
                                </div>
                              </div>
                            )}

                            {catData.status === 'rejected' && (
                              <div className="mt-4 pt-4 border-t">
                                <p className="text-sm text-red-600 font-medium">
                                  This category was rejected. Worker needs to resubmit documents.
                                </p>
                                <button 
                                  className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                                  onClick={() => handleVerifyCategory(selectedWorker._id, catData.category, 'verified')}
                                >
                                  ✓ Approve Now
                                </button>
                              </div>
                            )}

                            {catData.status === 'verified' && (
                              <div className="mt-4 pt-4 border-t">
                                <p className="text-sm text-green-600 font-medium">
                                  ✓ This category has been verified. Worker can receive service requests.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewer 
          documentUrl={selectedDocument.url} 
          documentType={selectedDocument.type}
          documentName={selectedDocument.name}
        />
      )}
    </div>
  );
}
