import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/pages/hooks/useAuth';
import { PageLoading } from '@/components/ui/page-loading';
import { PersonaModeSelector } from '@/components/PersonaModeSelector';

/**
 * Subprofile Selection Page - Onboarding Step
 * 
 * Shown after wallet setup during initial signup flow.
 * Users select their initial subprofile (okedi/yuki/amara).
 * 
 * Flow: Register → Wallet Setup → Subprofile Selection → Dashboard
 */

export default function SubprofileSelectionPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/register', { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return <PageLoading message="Preparing onboarding..." />;
  }

  const handleSubprofileSelected = (subprofile: string) => {
    // Redirect to dashboard after selection
    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 500);
  };

  return (
    <>
      <Helmet>
        <title>Choose Your Subprofile | Mtaa DAO</title>
        <meta
          name="description"
          content="Select your initial subprofile to personalize your dashboard"
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
          <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-6xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Welcome to Mtaa DAO! 🚀
            </h1>
            <p className="text-lg text-slate-300 mb-2">
              Let's personalize your experience
            </p>
            <p className="text-sm text-slate-400">
              Choose how you'd like to use Mtaa. You can change this anytime in Settings.
            </p>
          </div>

          {/* Subprofile Selector */}
          <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700 rounded-2xl p-8 sm:p-12">
            <PersonaModeSelector
              variant="cards"
              onChanged={handleSubprofileSelected}
            />
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">
              ℹ️ All features are accessible from any subprofile.
              <br />
              This just organizes your dashboard and personalizes your AI guidance.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
