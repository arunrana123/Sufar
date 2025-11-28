// Payment Service for Nepal Payment Gateways
// eSewa, Khalti, PhonePe integration
import { getApiUrl } from './config';

export interface PaymentRequest {
  amount: number;
  bookingId: string;
  serviceName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentId?: string;
  redirectUrl?: string;
  error?: string;
}

class PaymentService {
  private getBaseUrl(): string {
    return getApiUrl();
  }

  // eSewa Payment Integration
  async initiateEsewaPayment(paymentData: PaymentRequest): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/payments/esewa/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();
      
      if (result.success) {
        // In a real app, you would open the eSewa payment URL
        // For now, we'll simulate the payment process
        return {
          success: true,
          paymentId: result.paymentId,
          redirectUrl: result.redirectUrl,
        };
      } else {
        return {
          success: false,
          error: result.error || 'eSewa payment initiation failed',
        };
      }
    } catch (error) {
      console.error('eSewa payment error:', error);
      return {
        success: false,
        error: 'Network error during eSewa payment',
      };
    }
  }

  // Khalti Payment Integration
  async initiateKhaltiPayment(paymentData: PaymentRequest): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/payments/khalti/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();
      
      if (result.success) {
        return {
          success: true,
          paymentId: result.paymentId,
          redirectUrl: result.redirectUrl,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Khalti payment initiation failed',
        };
      }
    } catch (error) {
      console.error('Khalti payment error:', error);
      return {
        success: false,
        error: 'Network error during Khalti payment',
      };
    }
  }

  // PhonePe Payment Integration
  async initiatePhonePePayment(paymentData: PaymentRequest): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/payments/phonepe/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();
      
      if (result.success) {
        return {
          success: true,
          paymentId: result.paymentId,
          redirectUrl: result.redirectUrl,
        };
      } else {
        return {
          success: false,
          error: result.error || 'PhonePe payment initiation failed',
        };
      }
    } catch (error) {
      console.error('PhonePe payment error:', error);
      return {
        success: false,
        error: 'Network error during PhonePe payment',
      };
    }
  }

  // Verify Payment Status
  async verifyPayment(paymentId: string, method: 'esewa' | 'khalti' | 'phonepe'): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/payments/${method}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentId }),
      });

      const result = await response.json();
      
      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      console.error('Payment verification error:', error);
      return {
        success: false,
        error: 'Network error during payment verification',
      };
    }
  }

  // Get Payment Methods
  getPaymentMethods() {
    return [
      {
        id: 'esewa',
        name: 'eSewa',
        description: 'Pay with eSewa wallet',
        icon: 'wallet',
        color: '#00A651',
      },
      {
        id: 'khalti',
        name: 'Khalti',
        description: 'Pay with Khalti wallet',
        icon: 'card',
        color: '#5C2D91',
      },
      {
        id: 'phonepe',
        name: 'PhonePe',
        description: 'Pay with PhonePe',
        icon: 'phone-portrait',
        color: '#5F259F',
      },
    ];
  }

  // Format Amount for Display
  formatAmount(amount: number): string {
    return `Rs. ${amount.toLocaleString('en-NP')}`;
  }

  // Get Payment Status Text
  getPaymentStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Payment Pending';
      case 'paid':
        return 'Payment Successful';
      case 'failed':
        return 'Payment Failed';
      case 'refunded':
        return 'Payment Refunded';
      default:
        return 'Unknown Status';
    }
  }

  // Get Payment Status Color
  getPaymentStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'paid':
        return '#10B981';
      case 'failed':
        return '#EF4444';
      case 'refunded':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  }
}

export const paymentService = new PaymentService();