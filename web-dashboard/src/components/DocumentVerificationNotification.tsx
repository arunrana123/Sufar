'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Worker {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string;
}

interface DocumentVerificationNotificationProps {
  visible: boolean;
  worker: Worker | null;
  onView: () => void;
  onDismiss: () => void;
}

export default function DocumentVerificationNotification({
  visible,
  worker,
  onView,
  onDismiss,
}: DocumentVerificationNotificationProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(5);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (visible && worker) {
      setIsAnimating(true);
      setTimeLeft(5);
      
      // Countdown timer
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setTimeout(() => {
              setIsAnimating(false);
              onDismiss();
            }, 100);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [visible, worker, onDismiss]);

  if (!visible || !worker) return null;

  const handleView = () => {
    setIsAnimating(false);
    onView();
    router.push('/document-verification');
  };

  const progressPercentage = ((5 - timeLeft) / 5) * 100;

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        isAnimating
          ? 'animate-slide-in-right opacity-100'
          : 'opacity-0 translate-x-full pointer-events-none'
      }`}
    >
      <div className="bg-white rounded-lg shadow-2xl border-2 border-green-500 overflow-hidden min-w-[320px] max-w-[400px]">
        {/* Animated green border showing countdown */}
        <div className="relative h-1 bg-gray-200">
          <div
            className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            {/* Text Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                New Document Submission
              </h3>
              <p className="text-xs text-gray-600 mb-2">
                <span className="font-medium">{worker.name}</span> has submitted documents for verification
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleView}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors duration-200"
                >
                  View
                </button>
                <span className="text-xs text-gray-500">
                  {timeLeft}s
                </span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => {
                setIsAnimating(false);
                onDismiss();
              }}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

