import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Mail, X } from 'lucide-react';
import EmailVerificationModal from './EmailVerificationModal';

interface EmailVerificationBannerProps {
  onVerified?: () => void;
}

export default function EmailVerificationBanner({ onVerified }: EmailVerificationBannerProps) {
  const verificationStatus = useQuery(api.emailVerification.isEmailVerified);
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  // Don't show if already verified or dismissed
  if (verificationStatus?.verified || dismissed) {
    return null;
  }
  
  // Loading state
  if (verificationStatus === undefined) {
    return null;
  }
  
  return (
    <>
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Mail className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-sm text-amber-800">
                <span className="font-medium">Verify your email</span>
                <span className="hidden sm:inline"> to access all features including health assessments.</span>
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition"
              >
                Verify Now
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {showModal && (
        <EmailVerificationModal
          email={verificationStatus?.email || ''}
          onClose={() => setShowModal(false)}
          onVerified={() => {
            setShowModal(false);
            onVerified?.();
          }}
        />
      )}
    </>
  );
}











