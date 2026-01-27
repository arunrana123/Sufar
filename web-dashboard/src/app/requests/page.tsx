'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { socketService } from '../../lib/socketService';

type WorkerRequest = {
  _id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceCategory: string;
  experience: number;
  rating: number;
  isAvailable: boolean;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  documents: {
    name: string;
    type: string;
    url: string;
    uploadedAt: string;
  }[];
  personalInfo: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    dateOfBirth: string;
    emergencyContact: string;
    emergencyPhone: string;
  };
  professionalInfo: {
    certifications: string[];
    previousWork: string[];
    references: {
      name: string;
      phone: string;
      company: string;
    }[];
  };
  createdAt: string;
  updatedAt: string;
};

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<WorkerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<any>(null);
  const [selectedRequest, setSelectedRequest] = useState<WorkerRequest | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

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

    fetchRequests();
    
    // Connect to Socket.IO for real-time updates
    const adminId = parsedAdmin._id || parsedAdmin.id || 'admin-' + Date.now();
    socketService.connect(adminId, 'admin');

    // Listen for document verification updates
    const handleVerificationUpdated = (data: any) => {
      console.log('📢 Verification update received:', data);
      // Refresh requests to show updated status
      setTimeout(() => {
        fetchRequests();
      }, 500);
    };

    // Listen for new document submissions
    const handleDocumentSubmitted = (worker: any) => {
      console.log('📢 New document submission received:', worker);
      // Refresh requests to show new submissions
      setTimeout(() => {
        fetchRequests();
      }, 500);
    };
    
    const registerSocketListeners = () => {
      // Listen for verification status updates (when admin approves/rejects)
      socketService.on('document:verification:updated', handleVerificationUpdated);
      socketService.on('category:verification:updated', handleVerificationUpdated);
      
      // Listen for new document submissions (when worker submits documents)
      socketService.on('document:verification:submitted', handleDocumentSubmitted);
      
      // Also listen for notification events that might indicate new submissions
      socketService.on('notification:new', (notification: any) => {
        console.log('📢 New notification received:', notification);
        if (notification.type === 'document_verification' || notification.type === 'category_verification_submitted') {
          handleDocumentSubmitted(notification.data || { _id: notification.userId });
        }
      });
      
      console.log('✅ Socket.IO listeners registered for requests page');
    };

    // Wait a bit for connection to establish, then register listeners
    const connectTimeout = setTimeout(() => {
      if (!socketService.getIsConnected()) {
        console.warn('⚠️ Socket not connected yet, retrying listener registration...');
        // Retry after another second if not connected
        setTimeout(() => {
          registerSocketListeners();
        }, 1000);
        return;
      }
      
      registerSocketListeners();
    }, 1000);
    
    // Auto-refresh every 30 seconds as backup
    const interval = setInterval(() => {
      fetchRequests();
    }, 30000);

    return () => {
      clearTimeout(connectTimeout);
      clearInterval(interval);
      socketService.off('document:verification:updated', handleVerificationUpdated);
      socketService.off('category:verification:updated', handleVerificationUpdated);
      socketService.off('document:verification:submitted', handleDocumentSubmitted);
      socketService.off('notification:new');
    };
  }, [router]);

  const fetchRequests = async () => {
    try {
      // Mock data with detailed worker requests
      const mockRequests: WorkerRequest[] = [
        {
          _id: '1',
          username: 'john_plumber',
          firstName: 'John',
          lastName: 'Smith',
          email: 'john.smith@example.com',
          phone: '+1234567890',
          serviceCategory: 'Plumber',
          experience: 5,
          rating: 4.8,
          isAvailable: true,
          verificationStatus: 'pending',
          documents: [
            {
              name: 'Professional License',
              type: 'pdf',
              url: '/documents/john_license.pdf',
              uploadedAt: '2024-01-15T10:00:00Z',
            },
            {
              name: 'Insurance Certificate',
              type: 'pdf',
              url: '/documents/john_insurance.pdf',
              uploadedAt: '2024-01-15T10:05:00Z',
            },
            {
              name: 'ID Verification',
              type: 'jpg',
              url: '/documents/john_id.jpg',
              uploadedAt: '2024-01-15T10:10:00Z',
            },
          ],
          personalInfo: {
            address: '123 Main Street',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            dateOfBirth: '1985-03-15',
            emergencyContact: 'Jane Smith',
            emergencyPhone: '+1234567891',
          },
          professionalInfo: {
            certifications: ['Plumbing License NY-12345', 'Water Safety Certification'],
            previousWork: ['ABC Plumbing Co. (2019-2024)', 'XYZ Services (2017-2019)'],
            references: [
              {
                name: 'Mike Johnson',
                phone: '+1234567892',
                company: 'ABC Plumbing Co.',
              },
              {
                name: 'Sarah Wilson',
                phone: '+1234567893',
                company: 'XYZ Services',
              },
            ],
          },
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
        {
          _id: '2',
          username: 'sarah_electrician',
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah.johnson@example.com',
          phone: '+1234567891',
          serviceCategory: 'Electrician',
          experience: 8,
          rating: 4.9,
          isAvailable: false,
          verificationStatus: 'pending',
          documents: [
            {
              name: 'Electrical License',
              type: 'pdf',
              url: '/documents/sarah_electrical.pdf',
              uploadedAt: '2024-01-10T09:00:00Z',
            },
            {
              name: 'Safety Certification',
              type: 'pdf',
              url: '/documents/sarah_safety.pdf',
              uploadedAt: '2024-01-10T09:05:00Z',
            },
          ],
          personalInfo: {
            address: '456 Oak Avenue',
            city: 'Los Angeles',
            state: 'CA',
            zipCode: '90210',
            dateOfBirth: '1982-07-22',
            emergencyContact: 'Tom Johnson',
            emergencyPhone: '+1234567894',
          },
          professionalInfo: {
            certifications: ['Electrical License CA-67890', 'OSHA Safety Certification'],
            previousWork: ['Power Solutions Inc. (2016-2024)', 'Bright Electric (2014-2016)'],
            references: [
              {
                name: 'David Brown',
                phone: '+1234567895',
                company: 'Power Solutions Inc.',
              },
            ],
          },
          createdAt: '2024-01-10T09:00:00Z',
          updatedAt: '2024-01-10T09:00:00Z',
        },
        {
          _id: '3',
          username: 'mike_carpenter',
          firstName: 'Mike',
          lastName: 'Wilson',
          email: 'mike.wilson@example.com',
          phone: '+1234567892',
          serviceCategory: 'Carpenter',
          experience: 3,
          rating: 4.6,
          isAvailable: true,
          verificationStatus: 'pending',
          documents: [
            {
              name: 'Carpentry Certificate',
              type: 'pdf',
              url: '/documents/mike_carpentry.pdf',
              uploadedAt: '2024-01-20T11:00:00Z',
            },
            {
              name: 'Portfolio',
              type: 'pdf',
              url: '/documents/mike_portfolio.pdf',
              uploadedAt: '2024-01-20T11:05:00Z',
            },
          ],
          personalInfo: {
            address: '789 Pine Street',
            city: 'Chicago',
            state: 'IL',
            zipCode: '60601',
            dateOfBirth: '1990-11-08',
            emergencyContact: 'Lisa Wilson',
            emergencyPhone: '+1234567896',
          },
          professionalInfo: {
            certifications: ['Carpentry Certificate IL-11111'],
            previousWork: ['Fine Woodworks (2021-2024)'],
            references: [
              {
                name: 'Robert Davis',
                phone: '+1234567897',
                company: 'Fine Woodworks',
              },
            ],
          },
          createdAt: '2024-01-20T11:00:00Z',
          updatedAt: '2024-01-20T11:00:00Z',
        },
        {
          _id: '4',
          username: 'lisa_cleaner',
          firstName: 'Lisa',
          lastName: 'Brown',
          email: 'lisa.brown@example.com',
          phone: '+1234567893',
          serviceCategory: 'Cleaner',
          experience: 2,
          rating: 4.7,
          isAvailable: true,
          verificationStatus: 'approved',
          documents: [
            {
              name: 'Background Check',
              type: 'pdf',
              url: '/documents/lisa_background.pdf',
              uploadedAt: '2024-01-25T14:00:00Z',
            },
            {
              name: 'Cleaning Certification',
              type: 'pdf',
              url: '/documents/lisa_cleaning.pdf',
              uploadedAt: '2024-01-25T14:05:00Z',
            },
          ],
          personalInfo: {
            address: '321 Elm Street',
            city: 'Houston',
            state: 'TX',
            zipCode: '77001',
            dateOfBirth: '1992-05-12',
            emergencyContact: 'Mark Brown',
            emergencyPhone: '+1234567898',
          },
          professionalInfo: {
            certifications: ['Cleaning Services Certification'],
            previousWork: ['CleanPro Services (2022-2024)'],
            references: [
              {
                name: 'Jennifer White',
                phone: '+1234567899',
                company: 'CleanPro Services',
              },
            ],
          },
          createdAt: '2024-01-25T14:00:00Z',
          updatedAt: '2024-01-26T09:00:00Z',
        },
      ];

      // Try to fetch from backend if available
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const res = await fetch(`${apiUrl}/api/admin/workers`);
        
        if (res.ok) {
          const data = await res.json();
          // Map worker data to WorkerRequest format
          // Filter workers who have submitted documents for verification
          const workersWithSubmissions = data.filter((worker: any) => {
            // Check if worker has category documents submitted
            const hasCategoryDocs = worker.categoryDocuments && 
              Object.keys(worker.categoryDocuments).length > 0 &&
              Object.values(worker.categoryDocuments).some((catDocs: any) => 
                (catDocs && typeof catDocs === 'object' && (catDocs.skillProof || catDocs.experience))
              );
            
            // Check if worker has general documents submitted
            const hasGeneralDocs = worker.documents && 
              Object.values(worker.documents).some((doc: any) => doc && doc !== null && doc !== '');
            
            // Check if verification was submitted
            const hasSubmitted = worker.verificationSubmitted === true;
            
            // Include workers with category documents OR general documents (with or without verificationSubmitted flag)
            return hasCategoryDocs || hasGeneralDocs;
          });
          
          console.log(`📊 Found ${workersWithSubmissions.length} workers with verification submissions out of ${data.length} total`);
          
          const mappedRequests: WorkerRequest[] = workersWithSubmissions.map((worker: any) => ({
            _id: worker._id,
            username: worker.email?.split('@')[0] || 'worker',
            firstName: worker.name?.split(' ')[0] || 'Worker',
            lastName: worker.name?.split(' ').slice(1).join(' ') || '',
            email: worker.email || '',
            phone: worker.phone || '',
            serviceCategory: (() => {
              // If worker has category documents, show those categories
              if (worker.categoryDocuments && Object.keys(worker.categoryDocuments).length > 0) {
                return Object.keys(worker.categoryDocuments)[0];
              }
              // Otherwise use serviceCategories or skills
              return worker.serviceCategories?.[0] || worker.skills?.[0] || 'Service';
            })(),
            experience: parseInt(worker.experience) || 0,
            rating: worker.rating || 0,
            isAvailable: worker.isActive || false,
            verificationStatus: (() => {
              // Check category verification status first (new system)
              if (worker.categoryVerificationStatus && Object.keys(worker.categoryVerificationStatus).length > 0) {
                const categoryStatuses = Object.values(worker.categoryVerificationStatus);
                // If all categories are verified, overall is approved
                if (categoryStatuses.every((s: any) => s === 'verified')) return 'approved';
                // If any category is rejected, overall is rejected
                if (categoryStatuses.some((s: any) => s === 'rejected')) return 'rejected';
                // If any category is pending, overall is pending
                return 'pending';
              }
              // Fallback to general verification status
              if (typeof worker.verificationStatus === 'object' && worker.verificationStatus !== null) {
                const status = worker.verificationStatus as any;
                return status.overall === 'verified' ? 'approved' : (status.overall === 'rejected' ? 'rejected' : 'pending');
              }
              return worker.verificationStatus === 'verified' ? 'approved' : (worker.verificationStatus === 'rejected' ? 'rejected' : 'pending');
            })(),
            documents: (() => {
              const docs: any[] = [];
              // Add general documents
              if (worker.documents && typeof worker.documents === 'object') {
                Object.entries(worker.documents).forEach(([name, url]: [string, any]) => {
                  if (url && url !== null && url !== '') {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                    const docUrl = url.toString().startsWith('http') 
                      ? url 
                      : `${apiUrl}/uploads/${url}`;
                    docs.push({
                      name: name.replace(/([A-Z])/g, ' $1').trim(),
                      type: url?.toString().split('.').pop() || 'pdf',
                      url: docUrl,
                      uploadedAt: worker.submittedAt || worker.updatedAt || new Date().toISOString(),
                    });
                  }
                });
              }
              // Add category documents
              if (worker.categoryDocuments && typeof worker.categoryDocuments === 'object') {
                Object.entries(worker.categoryDocuments).forEach(([category, catDocs]: [string, any]) => {
                  if (catDocs && typeof catDocs === 'object') {
                    if (catDocs.skillProof && catDocs.skillProof !== null && catDocs.skillProof !== '') {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                      const docUrl = catDocs.skillProof.toString().startsWith('http') 
                        ? catDocs.skillProof 
                        : `${apiUrl}/uploads/${catDocs.skillProof}`;
                      docs.push({
                        name: `${category} - Service Certificate`,
                        type: catDocs.skillProof?.toString().split('.').pop() || 'pdf',
                        url: docUrl,
                        uploadedAt: worker.submittedAt || new Date().toISOString(),
                      });
                    }
                    if (catDocs.experience && catDocs.experience !== null && catDocs.experience !== '') {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                      const docUrl = catDocs.experience.toString().startsWith('http') 
                        ? catDocs.experience 
                        : `${apiUrl}/uploads/${catDocs.experience}`;
                      docs.push({
                        name: `${category} - Experience Certificate`,
                        type: catDocs.experience?.toString().split('.').pop() || 'pdf',
                        url: docUrl,
                        uploadedAt: worker.submittedAt || new Date().toISOString(),
                      });
                    }
                  }
                });
              }
              return docs;
            })(),
            personalInfo: {
              address: '',
              city: worker.currentLocation?.city || '',
              state: '',
              zipCode: '',
              dateOfBirth: '',
              emergencyContact: '',
              emergencyPhone: '',
            },
            professionalInfo: {
              certifications: worker.skills || [],
              previousWork: [],
              references: [],
            },
            createdAt: worker.submittedAt || worker.createdAt || new Date().toISOString(),
            updatedAt: worker.updatedAt || new Date().toISOString(),
          }));
          setRequests(mappedRequests);
          console.log('Requests synced with backend successfully');
        } else {
          console.warn('Backend sync failed, using mock data');
          setRequests(mockRequests);
        }
      } catch (backendError) {
        console.warn('Backend not available, using mock data:', backendError);
        setRequests(mockRequests);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const status = action === 'approve' ? 'verified' : 'rejected';
      
      // Find the request to get worker details
      const request = requests.find(r => r._id === requestId);
      if (!request) {
        alert('Request not found');
        return;
      }

      // Try to update worker verification status
      try {
        // First, try to get the worker to check their document structure
        const workerResponse = await fetch(`${apiUrl}/api/admin/workers`);
        if (workerResponse.ok) {
          const workers = await workerResponse.json();
          const worker = workers.find((w: any) => w._id === requestId);
          
          if (worker) {
            // Check if worker has category documents (new system)
            if (worker.categoryDocuments && Object.keys(worker.categoryDocuments).length > 0) {
              // Get all categories that need verification
              const categoriesToVerify = Object.keys(worker.categoryDocuments);
              
              // Verify all categories with pending status
              let allVerified = true;
              for (const category of categoriesToVerify) {
                const categoryStatus = worker.categoryVerificationStatus?.[category];
                // Only verify categories that are pending or undefined
                if (!categoryStatus || categoryStatus === 'pending') {
                  const categoryResponse = await fetch(`${apiUrl}/api/admin/verify-category`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      workerId: requestId,
                      category: category,
                      status,
                      rejectionReason: action === 'reject' ? `Request rejected by admin for ${category}` : undefined,
                    }),
                  });

                  if (!categoryResponse.ok) {
                    allVerified = false;
                    console.warn(`Failed to verify category ${category}`);
                  } else {
                    console.log(`✅ Category ${category} ${action}d successfully`);
                  }
                }
              }

              if (allVerified || categoriesToVerify.length > 0) {
                await fetchRequests();
                if (selectedRequest?._id === requestId) {
                  setSelectedRequest(null);
                }
                alert(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
                return;
              }
            }
            
            // Fallback: Update overall verification status via verify-document
            // Update all document types to the same status
            const documentTypes = ['profilePhoto', 'certificate', 'citizenship', 'license'];
            let updateSuccess = false;
            
            for (const docType of documentTypes) {
              try {
                const docResponse = await fetch(`${apiUrl}/api/admin/verify-document`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    workerId: requestId,
                    documentType: docType,
                    status,
                  }),
                });
                
                if (docResponse.ok) {
                  updateSuccess = true;
                }
              } catch (e) {
                console.warn(`Failed to update ${docType}:`, e);
              }
            }
            
            if (updateSuccess) {
              console.log(`✅ Request ${action}d successfully`);
              await fetchRequests();
              if (selectedRequest?._id === requestId) {
                setSelectedRequest(null);
              }
              alert(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
              return;
            }
          }
        }
        
        // If all else fails, show error
        throw new Error('Could not update worker verification status');
      } catch (backendError: any) {
        console.error('Error updating request verification:', backendError);
        
        // Fallback: Update local state
        setRequests(prev => prev.map(r => 
          r._id === requestId 
            ? { 
                ...r, 
                verificationStatus: action === 'approve' ? 'approved' : 'rejected',
                updatedAt: new Date().toISOString()
              }
            : r
        ));
        
        alert(`Request ${action}d locally, but could not sync with backend. Please refresh the page.`);
      }
    } catch (error) {
      console.error('Error updating request verification:', error);
      alert('Failed to update request. Please try again.');
    }
  };

  const handleDeleteRequest = async (requestId: string, workerName: string) => {
    if (!confirm(`Are you sure you want to delete the request from "${workerName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const res = await fetch(`${apiUrl}/api/admin/workers/${requestId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setRequests(requests.filter(request => request._id !== requestId));
        if (selectedRequest?._id === requestId) {
          setSelectedRequest(null);
        }
        alert('Request deleted successfully!');
      } else {
        const errorData = await res.json();
        alert(errorData.message || 'Failed to delete request. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting request:', error);
      alert('Failed to delete request. Please try again.');
    }
  };

  const handleClearAllRequests = async () => {
    const statusMap: { [key: string]: string | undefined } = {
      'pending': 'pending',
      'approved': 'verified',
      'rejected': 'rejected',
      'all': undefined
    };
    
    const backendStatus = statusMap[filter];
    const filteredCount = filteredRequests.length;
    
    if (filteredCount === 0) {
      alert('No requests to delete.');
      return;
    }

    const statusText = filter === 'all' ? 'all' : filter;
    if (!confirm(`Are you sure you want to delete all ${filteredCount} ${statusText} requests? This action cannot be undone.`)) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const url = backendStatus 
        ? `${apiUrl}/api/admin/workers?status=${backendStatus}`
        : `${apiUrl}/api/admin/workers`;
      
      const res = await fetch(url, {
        method: 'DELETE',
      });

      if (res.ok) {
        const data = await res.json();
        // Remove deleted requests from state
        if (backendStatus) {
          setRequests(requests.filter(request => request.verificationStatus !== filter));
        } else {
          setRequests([]);
        }
        setSelectedRequest(null);
        alert(`All ${data.deletedCount} ${statusText} requests deleted successfully!`);
      } else {
        const errorData = await res.json();
        alert(errorData.message || 'Failed to delete all requests. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting all requests:', error);
      alert('Failed to delete all requests. Please try again.');
    }
  };

  const filteredRequests = requests.filter(request => {
    if (filter === 'all') return true;
    return request.verificationStatus === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'approved': return '✅';
      case 'rejected': return '❌';
      default: return '❓';
    }
  };

  if (loading || !admin) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Worker Verification Requests</h1>
          <p className="text-gray-600 mt-2">Review and approve worker applications</p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            {[
              { key: 'pending', label: 'Pending', count: requests.filter(r => r.verificationStatus === 'pending').length },
              { key: 'approved', label: 'Approved', count: requests.filter(r => r.verificationStatus === 'approved').length },
              { key: 'rejected', label: 'Rejected', count: requests.filter(r => r.verificationStatus === 'rejected').length },
              { key: 'all', label: 'All', count: requests.length },
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
        </div>

        {/* Requests List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {filter === 'all' ? 'All Requests' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Requests`} ({filteredRequests.length})
            </h3>
            {filteredRequests.length > 0 && (
              <button
                onClick={handleClearAllRequests}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Worker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documents
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => (
                  <tr key={request._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold">
                              {request.firstName[0]}{request.lastName[0]}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {request.firstName} {request.lastName}
                          </div>
                          <div className="text-sm text-gray-500">@{request.username}</div>
                          <div className="text-xs text-gray-400">{request.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {request.serviceCategory}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">{request.experience} years experience</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {request.documents.length} document{request.documents.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {request.documents.slice(0, 2).map(doc => doc.name).join(', ')}
                        {request.documents.length > 2 && ` +${request.documents.length - 2} more`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.verificationStatus)}`}>
                        <span className="mr-1">{getStatusIcon(request.verificationStatus)}</span>
                        {request.verificationStatus.charAt(0).toUpperCase() + request.verificationStatus.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                        >
                          Review
                        </button>
                        {request.verificationStatus === 'pending' && (
                          <>
                            <button
                              onClick={() => handleVerifyRequest(request._id, 'approve')}
                              className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleVerifyRequest(request._id, 'reject')}
                              className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteRequest(request._id, `${request.firstName} ${request.lastName}`)}
                          className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Delete request"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Request Detail Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Worker Verification Request - {selectedRequest.firstName} {selectedRequest.lastName}
                </h3>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Personal Information */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Full Name</label>
                      <p className="text-sm text-gray-900">{selectedRequest.firstName} {selectedRequest.lastName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-sm text-gray-900">{selectedRequest.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone</label>
                      <p className="text-sm text-gray-900">{selectedRequest.phone}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                      <p className="text-sm text-gray-900">{selectedRequest.personalInfo.dateOfBirth}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Address</label>
                      <p className="text-sm text-gray-900">
                        {selectedRequest.personalInfo.address}, {selectedRequest.personalInfo.city}, {selectedRequest.personalInfo.state} {selectedRequest.personalInfo.zipCode}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Emergency Contact</label>
                      <p className="text-sm text-gray-900">
                        {selectedRequest.personalInfo.emergencyContact} - {selectedRequest.personalInfo.emergencyPhone}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Professional Information */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Professional Information</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Service Category</label>
                      <p className="text-sm text-gray-900">{selectedRequest.serviceCategory}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Experience</label>
                      <p className="text-sm text-gray-900">{selectedRequest.experience} years</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Certifications</label>
                      <ul className="text-sm text-gray-900 list-disc list-inside">
                        {selectedRequest.professionalInfo.certifications.map((cert, index) => (
                          <li key={index}>{cert}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Previous Work</label>
                      <ul className="text-sm text-gray-900 list-disc list-inside">
                        {selectedRequest.professionalInfo.previousWork.map((work, index) => (
                          <li key={index}>{work}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">References</label>
                      <div className="space-y-2">
                        {selectedRequest.professionalInfo.references.map((ref, index) => (
                          <div key={index} className="text-sm text-gray-900">
                            <strong>{ref.name}</strong> - {ref.company}<br />
                            <span className="text-gray-500">{ref.phone}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Documents</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedRequest.documents.map((doc, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-medium text-gray-900">{doc.name}</h5>
                          <span className="text-xs text-gray-500 uppercase">{doc.type}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Document
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Close
                </button>
                {selectedRequest.verificationStatus === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        handleVerifyRequest(selectedRequest._id, 'reject');
                        setSelectedRequest(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        handleVerifyRequest(selectedRequest._id, 'approve');
                        setSelectedRequest(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors"
                    >
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
