// USER PERMISSIONS & ROLE VERIFICATION
// Checks user roles and permissions for accessing features
// Roles: 'user' (customer), 'admin' (dashboard access), 'worker' (service provider - different app)

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  [key: string]: any;
}

/**
 * Checks if user has specific role
 * Triggered by: Before accessing protected features
 */
export const hasRole = (user: User | null, role: UserRole): boolean => {
  if (!user) return false;
  return user.role === role;
};

/**
 * Checks if user is admin
 * Triggered by: Before showing admin-only features
 */
export const isAdmin = (user: User | null): boolean => {
  return hasRole(user, 'admin');
};

/**
 * Checks if user is regular customer
 * Triggered by: Default user features
 */
export const isRegularUser = (user: User | null): boolean => {
  return hasRole(user, 'user');
};

/**
 * Checks if user can book services
 * Requirements: Must be logged in and have 'user' role
 */
export const canBookService = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'user';
};

/**
 * Checks if user can track bookings
 * Requirements: Must be logged in
 */
export const canTrackBooking = (user: User | null): boolean => {
  return !!user;
};

/**
 * Checks if user can review services
 * Requirements: Must be logged in and booking must be completed
 */
export const canReviewService = (user: User | null, bookingStatus?: string): boolean => {
  if (!user) return false;
  if (!bookingStatus) return false;
  return bookingStatus === 'completed';
};

/**
 * Checks if user can cancel booking
 * Requirements: Booking must be in pending or accepted status
 */
export const canCancelBooking = (bookingStatus: string): boolean => {
  return ['pending', 'accepted'].includes(bookingStatus);
};

/**
 * Checks if user can access payment
 * Requirements: Must be logged in
 */
export const canAccessPayment = (user: User | null): boolean => {
  return !!user;
};

/**
 * Gets user-friendly permission error message
 * Triggered by: When permission check fails
 */
export const getPermissionErrorMessage = (action: string): string => {
  switch (action) {
    case 'book':
      return 'You must be logged in to book a service. Please sign in or create an account.';
    case 'track':
      return 'You must be logged in to track your bookings.';
    case 'review':
      return 'You can only review completed services.';
    case 'cancel':
      return 'You can only cancel pending or accepted bookings.';
    case 'payment':
      return 'You must be logged in to make payments.';
    default:
      return 'You do not have permission to perform this action.';
  }
};

/**
 * Validates user can perform action and shows alert if not
 * Returns: true if allowed, false if denied (with alert shown)
 */
export const checkPermissionWithAlert = (
  user: User | null,
  action: 'book' | 'track' | 'review' | 'cancel' | 'payment',
  Alert: any,
  additionalCheck?: boolean
): boolean => {
  let allowed = false;
  
  switch (action) {
    case 'book':
      allowed = canBookService(user);
      break;
    case 'track':
      allowed = canTrackBooking(user);
      break;
    case 'payment':
      allowed = canAccessPayment(user);
      break;
    default:
      allowed = !!user;
  }
  
  if (additionalCheck !== undefined) {
    allowed = allowed && additionalCheck;
  }
  
  if (!allowed) {
    Alert.alert('Permission Denied', getPermissionErrorMessage(action));
  }
  
  return allowed;
};

