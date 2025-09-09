import React from 'react';
import WalletSetup from '../components/WalletSetup';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

export default function WalletSetupPage() {
  const navigate = useNavigate();
  
  // Get user ID from auth context
  const { user } = useAuth();
  // Type user for safety
  type AuthUser = { id?: string; _id?: string; userId?: string };
  const typedUser = user as AuthUser | null;
  const userId = typedUser?.id || typedUser?._id || typedUser?.userId || "";

  const handleWalletCreated = (walletData: any) => {
    console.log('Wallet created:', walletData);
    // Navigate to wallet or dashboard after successful setup
    navigate('/wallet');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <WalletSetup 
        userId={userId} 
        onWalletCreated={handleWalletCreated}
      />
    </div>
  );
}
