// DOCUMENT VERIFICATION PAGE - Admin tool to verify worker documents (photos, certificates, citizenship, license)
// Features: View uploaded documents, approve/reject each document, add verification notes, Socket.IO real-time updates
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import SidebarLayout from '../../components/SidebarLayout';
import { useRouter } from 'next/navigation';
import { socketService } from '../../lib/socketService';

interface Document {
  profilePhoto?: string;
  certificate?: string;
  citizenship?: string;
  license?: string;
}

interface VerificationStatus {
  profilePhoto?: 'pending' | 'verified' | 'rejected';
  certificate?: 'pending' | 'verified' | 'rejected';
  citizenship?: 'pending' | 'verified' | 'rejected';
  license?: 'pending' | 'verified' | 'rejected';
  overall?: 'pending' | 'verified' | 'rejected';
}

interface Worker {
  _id: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  documents: Document;
  verificationStatus: VerificationStatus | string;
  verificationNotes?: string;
  verificationSubmitted?: boolean;
  submittedAt?: string;
  createdAt?: string;
  profileImage?: string;
  rating: number;
  completedJobs: number;
  experience?: string;
}

export default function DocumentVerificationPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');

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

    // Listen for document verification submissions
    const handleDocumentSubmitted = (worker: any) => {
      console.log('📢 New document submission received in document verification page:', worker);
      // Immediately refresh workers list to show new submission
      fetchWorkers();
    };

    // Wait a bit for connection to establish
    const connectTimeout = setTimeout(() => {
      socketService.on('document:verification:submitted', handleDocumentSubmitted);
      console.log('✅ Socket.IO listener registered for document:verification:submitted in document verification page');
    }, 1000);
    
    // Auto-refresh every 30 seconds to get new workers (as backup)
    const interval = setInterval(() => {
      fetchWorkers();
    }, 30000);

    return () => {
      clearTimeout(connectTimeout);
      clearInterval(interval);
      socketService.off('document:verification:submitted', handleDocumentSubmitted);
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
      console.log('📋 Sample worker data:', data[0] ? {
        name: data[0].name,
        verificationSubmitted: data[0].verificationSubmitted,
        hasDocuments: !!data[0].documents,
        documentKeys: data[0].documents ? Object.keys(data[0].documents) : [],
      } : 'No workers');
      
      // Filter workers who have submitted documents for verification
      // The backend already filters, but we ensure documents exist and are not empty
      const filteredWorkers = data.filter((worker: Worker) => {
        // Check if worker has submitted verification OR has documents
        const hasSubmitted = worker.verificationSubmitted === true;
        
        // Check if documents exist and have at least one non-empty value
        const docKeys = worker.documents ? Object.keys(worker.documents) : [];
        const hasDocuments = docKeys.some(key => {
          const value = worker.documents[key as keyof Document];
          return value && value !== null && value !== '';
        });
        
        if (!hasSubmitted && !hasDocuments) {
          console.log(`⚠️ Worker ${worker.name} excluded: Submitted=${hasSubmitted}, HasDocs=${hasDocuments}`);
          return false;
        }
        
        if (!hasDocuments) {
          console.log(`⚠️ Worker ${worker.name} has no valid documents`);
          return false;
        }
        
        return true;
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

  const getOverallStatus = (worker: Worker): 'pending' | 'verified' | 'rejected' => {
    if (typeof worker.verificationStatus === 'string') {
      return worker.verificationStatus as 'pending' | 'verified' | 'rejected';
    }
    const status = worker.verificationStatus as VerificationStatus;
    if (status.overall) {
      return status.overall;
    }
    // Check individual document statuses
    const statuses = Object.values(status).filter(s => s !== 'pending' && s !== undefined);
    if (statuses.length === 0) return 'pending';
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

  const handleVerifyDocument = async (workerId: string, documentType: string, status: 'verified' | 'rejected') => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/admin/verify-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId,
          documentType,
          status,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Refresh workers to get updated status
        await fetchWorkers();
        
        // Update selected worker if it's the one being verified
        if (selectedWorker?._id === workerId) {
          const updatedWorker = workers.find(w => w._id === workerId);
          if (updatedWorker) {
            setSelectedWorker(updatedWorker);
          }
        }
        
        alert(`Document ${status === 'verified' ? 'approved' : 'rejected'} successfully!`);
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to verify document');
      }
    } catch (error) {
      console.error('Error verifying document:', error);
      alert('Failed to verify document. Please try again.');
    }
  };

  const DocumentViewer = ({ documentUrl, documentType }: { documentUrl: string; documentType: string }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold capitalize">{documentType.replace(/([A-Z])/g, ' $1')}</h3>
          <button 
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={() => setSelectedDocument(null)}
          >
            Close
          </button>
        </div>
        <div className="relative">
          <Image
            src={documentUrl}
            alt={documentType}
            width={800}
            height={600}
            className="rounded-lg"
            style={{ objectFit: 'contain' }}
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => window.open(documentUrl, '_blank')}
          >
            📥 Download
          </button>
          <button 
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={() => window.open(documentUrl, '_blank')}
          >
            👁 Open in New Tab
          </button>
        </div>
      </div>
    </div>
  );

  if (!admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <SidebarLayout adminName={admin.name}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout adminName={admin.name}>
      <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Document Verification</h1>
        <p className="text-gray-600 mt-2">Review and verify worker documents ({workers.length} workers submitted)</p>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Worker Verification Details</h2>
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                onClick={() => setSelectedWorker(null)}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Worker Info */}
              <div className="bg-white rounded-lg border p-6">
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
                    <span className="mr-2 text-gray-500">📅</span>
                    <span>Submitted: {selectedWorker.submittedAt 
                      ? new Date(selectedWorker.submittedAt).toLocaleDateString() 
                      : selectedWorker.createdAt 
                        ? new Date(selectedWorker.createdAt).toLocaleDateString() 
                        : 'N/A'}</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Skills:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedWorker.skills && selectedWorker.skills.length > 0 ? (
                        selectedWorker.skills.map((skill, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-sm">{skill}</span>
                        ))
                      ) : (
                        <span className="text-gray-500 text-sm">No skills listed</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="bg-white rounded-lg border p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <span className="mr-2">📄</span>
                    Documents
                  </h3>
                </div>
                <div className="space-y-4">
                  {selectedWorker.documents && Object.entries(selectedWorker.documents).length > 0 ? (
                    Object.entries(selectedWorker.documents).map(([docType, docUrl]) => {
                      const status = typeof selectedWorker.verificationStatus === 'object' && selectedWorker.verificationStatus
                        ? (selectedWorker.verificationStatus as VerificationStatus)[docType as keyof VerificationStatus]
                        : 'pending';
                      const docStatus = status || 'pending';
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                      const fullDocUrl = docUrl?.startsWith('http') ? docUrl : `${apiUrl}/uploads/${docUrl}`;
                      
                      return docUrl && (
                        <div key={docType} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium capitalize">
                              {docType.replace(/([A-Z])/g, ' $1')}
                            </h4>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(docStatus)}
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(docStatus)}`}>
                                {docStatus}
                              </span>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button 
                              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                              onClick={() => setSelectedDocument(fullDocUrl)}
                            >
                              👁 View
                            </button>
                            {docStatus === 'pending' && (
                              <>
                                <button 
                                  className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                                  onClick={() => handleVerifyDocument(selectedWorker._id, docType, 'verified')}
                                >
                                  ✓ Approve
                                </button>
                                <button 
                                  className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                                  onClick={() => handleVerifyDocument(selectedWorker._id, docType, 'rejected')}
                                >
                                  ✗ Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <span className="text-4xl mb-2 block">📄</span>
                      <p>No documents uploaded yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewer 
          documentUrl={selectedDocument} 
          documentType={Object.keys(selectedWorker?.documents || {}).find(
            key => selectedWorker?.documents[key as keyof Document] === selectedDocument
          ) || 'document'} 
        />
      )}
      </div>
    </SidebarLayout>
  );
}
