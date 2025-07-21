
import React from 'react';
import { PersonalVaultSection } from './wallet/PesonalVaultBalance';


export default function WalletDashboard() {
  // The dashboard is now unified with the personal vault UI
  return (
    <div style={{ padding: 24 }}>
      <h1>Wallet Dashboard</h1>
      <PersonalVaultSection />
    </div>
  );
}
