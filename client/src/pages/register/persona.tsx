/**
 * Persona Selection Page
 * 
 * Part of signup flow - comes after wallet setup
 * User selects their persona (Okedi, Yuki, Amara) to complete onboarding
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import PersonaSelector from '@/components/PersonaSelector';

export default function PersonaSelectionPage() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    // After persona selection, redirect to dashboard
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <PersonaSelector 
        isSignupFlow={true}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
