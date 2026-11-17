import { useState, useCallback, useEffect } from 'react';

interface SecurityFeature {
  id: string;
  name: string;
  enabled: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  lastUpdated?: string;
}

interface SecurityStatusData {
  overallRisk: 'low' | 'medium' | 'high';
  accountAge: string;
  lastLogin: string;
  lastPasswordChange?: string;
  features: SecurityFeature[];
}

interface SecuritySetupState {
  loading: boolean;
  error: string | null;
  securityStatus: SecurityStatusData | null;
  twoFASetupInProgress: boolean;
  passwordResetInProgress: boolean;
  savingBackupCodes: boolean;
}

export function useSecuritySetup(userId: string) {
  const [state, setState] = useState<SecuritySetupState>({
    loading: true,
    error: null,
    securityStatus: null,
    twoFASetupInProgress: false,
    passwordResetInProgress: false,
    savingBackupCodes: false
  });

  // Fetch security status
  useEffect(() => {
    const fetchSecurityStatus = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        // Mock API call - replace with real endpoint
        const response = await new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              overallRisk: 'medium' as const,
              accountAge: '1 year, 3 months',
              lastLogin: '2 hours ago',
              lastPasswordChange: '6 months ago',
              features: [
                {
                  id: 'two-fa',
                  name: 'Two-Factor Authentication',
                  enabled: false,
                  riskLevel: 'high' as const,
                  lastUpdated: undefined
                },
                {
                  id: 'password',
                  name: 'Strong Password',
                  enabled: true,
                  riskLevel: 'low' as const,
                  lastUpdated: '6 months ago'
                },
                {
                  id: 'recovery',
                  name: 'Recovery Email',
                  enabled: true,
                  riskLevel: 'low' as const,
                  lastUpdated: '1 year ago'
                },
                {
                  id: 'sessions',
                  name: 'Session Management',
                  enabled: true,
                  riskLevel: 'low' as const,
                  lastUpdated: '2 hours ago'
                }
              ]
            });
          }, 800);
        });

        setState(prev => ({
          ...prev,
          loading: false,
          securityStatus: response as any
        }));
      } catch (err) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load security status'
        }));
      }
    };

    fetchSecurityStatus();
  }, [userId]);

  const enableTwoFA = useCallback(async (backupCodes: string[]) => {
    try {
      setState(prev => ({ ...prev, twoFASetupInProgress: true, error: null }));

      // Mock API call - replace with real endpoint
      const response = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, transactionHash: '0x' + Math.random().toString(16).slice(2) });
        }, 1500);
      });

      setState(prev => ({
        ...prev,
        twoFASetupInProgress: false,
        securityStatus: prev.securityStatus
          ? {
              ...prev.securityStatus,
              features: prev.securityStatus.features.map(f =>
                f.id === 'two-fa' ? { ...f, enabled: true, lastUpdated: 'now' } : f
              )
            }
          : null
      }));

      return response;
    } catch (err) {
      setState(prev => ({
        ...prev,
        twoFASetupInProgress: false,
        error: 'Failed to enable 2FA. Please try again.'
      }));
      throw err;
    }
  }, []);

  const disableTwoFA = useCallback(async (password: string) => {
    try {
      setState(prev => ({ ...prev, twoFASetupInProgress: true, error: null }));

      // Mock API call - verify password and disable 2FA
      const response = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true });
        }, 1500);
      });

      setState(prev => ({
        ...prev,
        twoFASetupInProgress: false,
        securityStatus: prev.securityStatus
          ? {
              ...prev.securityStatus,
              features: prev.securityStatus.features.map(f =>
                f.id === 'two-fa' ? { ...f, enabled: false } : f
              )
            }
          : null
      }));

      return response;
    } catch (err) {
      setState(prev => ({
        ...prev,
        twoFASetupInProgress: false,
        error: 'Failed to disable 2FA. Please try again.'
      }));
      throw err;
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      setState(prev => ({ ...prev, passwordResetInProgress: true, error: null }));

      // Mock API call - validate current password and set new one
      const response = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true });
        }, 1500);
      });

      setState(prev => ({
        ...prev,
        passwordResetInProgress: false,
        securityStatus: prev.securityStatus
          ? {
              ...prev.securityStatus,
              lastPasswordChange: 'now'
            }
          : null
      }));

      return response;
    } catch (err) {
      setState(prev => ({
        ...prev,
        passwordResetInProgress: false,
        error: 'Failed to change password. Please try again.'
      }));
      throw err;
    }
  }, []);

  const revokeAllSessions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Mock API call
      const response = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, message: 'All sessions revoked' });
        }, 1000);
      });

      setState(prev => ({
        ...prev,
        loading: false
      }));

      return response;
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to revoke sessions. Please try again.'
      }));
      throw err;
    }
  }, []);

  const saveBackupCodes = useCallback(async (codes: string[]) => {
    try {
      setState(prev => ({ ...prev, savingBackupCodes: true, error: null }));

      // Mock API call - acknowledge backup codes saved
      const response = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true });
        }, 800);
      });

      setState(prev => ({
        ...prev,
        savingBackupCodes: false
      }));

      return response;
    } catch (err) {
      setState(prev => ({
        ...prev,
        savingBackupCodes: false,
        error: 'Failed to save backup codes. Please try again.'
      }));
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    enableTwoFA,
    disableTwoFA,
    changePassword,
    revokeAllSessions,
    saveBackupCodes,
    clearError
  };
}
