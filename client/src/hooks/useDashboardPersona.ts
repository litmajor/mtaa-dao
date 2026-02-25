import { useEffect, useState } from 'react';
import { useAuth } from '@/pages/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

export type DashboardPersona = 'okedi' | 'yuki' | 'amara';

export interface PersonaData {
  persona: DashboardPersona;
  accountAge: number; // days since account creation
  totalBalance: number; // in USD
  daoCount: number;
  daoRoles: string[]; // ['member', 'proposer', 'admin']
  featuresUnlocked: string[];
  transactionCount: number;
}

/**
 * Hook to detect which user persona (Okedi, Yuki, Amara) should be shown
 * Based on account age, balance, DAO role, and feature adoption
 */
export function useDashboardPersona() {
  const { user, isLoading } = useAuth();
  const [persona, setPersona] = useState<DashboardPersona>('okedi');
  const [personaData, setPersonaData] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading || !user?.id) {
      return;
    }

    const detectPersona = async () => {
      try {
        // Fetch persona detection data
        const response = await apiRequest('GET', '/api/users/persona-data');
        
        if (!response || typeof response !== 'object') {
          console.error('Invalid persona data response');
          setPersona('okedi');
          setLoading(false);
          return;
        }

        const data = response as PersonaData;
        setPersonaData(data);

        // Logic to determine persona
        let detectedPersona: DashboardPersona = 'okedi';

        // Amara: Advanced user (power user)
        // - Account age > 60 days OR
        // - Total balance > $50,000 OR
        // - Has trading/arbitrage features unlocked OR
        // - Is an elder/proposer in multiple DAOs
        if (
          data.accountAge > 60 ||
          data.totalBalance > 50000 ||
          data.featuresUnlocked.includes('trading.dex') ||
          (data.daoRoles.includes('elder') || data.daoRoles.includes('proposer')) && data.daoCount > 2
        ) {
          detectedPersona = 'amara';
        }
        // Yuki: Intermediate user (community builder)
        // - Account age > 14 days AND
        // - Has joined a DAO OR
        // - Created a proposal OR
        // - Total balance > $5,000
        else if (
          (data.accountAge > 14 && (data.daoCount > 0 || data.daoRoles.includes('proposer'))) ||
          data.totalBalance > 5000
        ) {
          detectedPersona = 'yuki';
        }
        // Okedi: Beginner (default)
        // - Account age <= 14 days OR
        // - No DAOs joined yet OR
        // - Very low balance
        else {
          detectedPersona = 'okedi';
        }

        setPersona(detectedPersona);
      } catch (error) {
        console.error('Failed to detect persona:', error);
        setPersona('okedi');
      } finally {
        setLoading(false);
      }
    };

    detectPersona();
  }, [user?.id, isLoading]);

  return {
    persona,
    personaData,
    loading,
  };
}
