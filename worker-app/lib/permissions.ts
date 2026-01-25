// WORKER PERMISSIONS & VERIFICATION STATUS
// Checks worker verification status and permissions for accepting jobs
// Statuses: 'pending' (documents under review), 'verified' (approved), 'rejected' (denied)

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Worker {
  id: string;
  email: string;
  name: string;
  verificationStatus?: VerificationStatus | any;
  isActive?: boolean;
  [key: string]: any;
}

/**
 * Checks if worker is fully verified
 * Triggered by: Before allowing to go online/accept jobs
 */
export const isVerified = (worker: Worker | null): boolean => {
  if (!worker) return false;
  
  // Check if verificationStatus is an object with overall field
  if (worker.verificationStatus && typeof worker.verificationStatus === 'object') {
    return worker.verificationStatus.overall === 'verified';
  }
  
  // Check if verificationStatus is a string
  return worker.verificationStatus === 'verified';
};

/**
 * Checks if worker can go online (toggle Available)
 * Requirements: Must be verified and have uploaded documents
 */
export const canGoOnline = (worker: Worker | null): boolean => {
  if (!worker) return false;
  return isVerified(worker);
};

/**
 * Checks if worker can accept booking requests
 * Requirements: Must be verified and online (available)
 */
export const canAcceptBookings = (worker: Worker | null): boolean => {
  if (!worker) return false;
  return isVerified(worker) && worker.isActive === true;
};

/**
 * Checks if worker has at least one verified service category
 * Requirements: Must have at least one service category with 'verified' status
 */
export const hasVerifiedService = (worker: Worker | null): boolean => {
  if (!worker || !worker.serviceCategories || worker.serviceCategories.length === 0) {
    return false;
  }
  
  return worker.serviceCategories.some((category: string) => {
    const status = worker.categoryVerificationStatus?.[category];
    return status === 'verified';
  });
};

/**
 * Checks if worker is fully verified (overall + has verified services)
 * Requirements: Overall verification status is 'verified' AND has at least one verified service category
 */
export const isFullyVerified = (worker: Worker | null): boolean => {
  if (!worker) return false;
  return isVerified(worker) && hasVerifiedService(worker);
};

/**
 * Checks if worker needs to upload documents
 * Returns true if any required document is missing
 */
export const needsDocumentUpload = (worker: Worker | null): boolean => {
  if (!worker) return true;
  
  const docs = worker.documents || {};
  const requiredDocs = ['profilePhoto', 'certificate', 'citizenship'];
  
  return requiredDocs.some(doc => !docs[doc]);
};

/**
 * Checks if worker documents are under review
 */
export const isUnderReview = (worker: Worker | null): boolean => {
  if (!worker) return false;
  
  if (worker.verificationStatus && typeof worker.verificationStatus === 'object') {
    return worker.verificationStatus.overall === 'pending';
  }
  
  return worker.verificationStatus === 'pending';
};

/**
 * Checks if worker was rejected
 */
export const isRejected = (worker: Worker | null): boolean => {
  if (!worker) return false;
  
  if (worker.verificationStatus && typeof worker.verificationStatus === 'object') {
    return worker.verificationStatus.overall === 'rejected';
  }
  
  return worker.verificationStatus === 'rejected';
};

/**
 * Gets verification status message for worker
 */
export const getVerificationMessage = (worker: Worker | null): string => {
  if (!worker) return 'Please log in to continue';
  
  if (needsDocumentUpload(worker)) {
    return '📄 Upload your documents to get verified and start accepting jobs';
  }
  
  if (isUnderReview(worker)) {
    return '⏳ Your documents are under review. You\'ll be notified once verified.';
  }
  
  if (isRejected(worker)) {
    return '❌ Verification rejected. Please check your profile for details and re-upload documents.';
  }
  
  if (isVerified(worker)) {
    return '✅ You are verified! Toggle Available to start receiving job requests.';
  }
  
  return 'Complete your profile to start earning';
};

/**
 * Gets permission error message for workers
 */
export const getWorkerPermissionError = (action: string): string => {
  switch (action) {
    case 'go_online':
      return 'You must be verified before going online. Please upload and verify your documents first.';
    case 'accept_booking':
      return 'You must be verified and online to accept bookings.';
    case 'upload_docs':
      return 'Please complete your profile before uploading documents.';
    default:
      return 'You do not have permission to perform this action.';
  }
};

/**
 * Validates worker can perform action and shows alert if not
 * Returns: true if allowed, false if denied (with alert shown)
 */
export const checkWorkerPermission = (
  worker: Worker | null,
  action: 'go_online' | 'accept_booking' | 'upload_docs',
  Alert: any
): boolean => {
  let allowed = false;
  
  switch (action) {
    case 'go_online':
      allowed = canGoOnline(worker);
      break;
    case 'accept_booking':
      allowed = canAcceptBookings(worker);
      break;
    case 'upload_docs':
      allowed = !!worker;
      break;
    default:
      allowed = false;
  }
  
  if (!allowed) {
    Alert.alert('Permission Denied', getWorkerPermissionError(action));
  }
  
  return allowed;
};

