/**
 * Biometric Unlock Component
 * Support for fingerprint, Face ID, and Windows Hello
 */

import React, { useEffect, useState } from 'react';
import {
  Fingerprint,
  AlertCircle,
  CheckCircle,
  Loader,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BiometricUnlockProps {
  onSuccess?: (biometricData: any) => void;
  onError?: (error: string) => void;
}

export const BiometricUnlock: React.FC<BiometricUnlockProps> = ({
  onSuccess,
  onError,
}) => {
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>(
    'info'
  );

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      // Check if WebAuthn is available
      if (!window.PublicKeyCredential) {
        setIsBiometricAvailable(false);
        return;
      }

      // Check if platform authenticator is available (biometric sensor)
      const available =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

      if (available) {
        setIsBiometricAvailable(true);

        // Detect biometric type
        detectBiometricType();
      }
    } catch (error) {
      console.error('Biometric check failed:', error);
      setIsBiometricAvailable(false);
    }
  };

  const detectBiometricType = async () => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      setBiometricType('face_id');
    } else if (userAgent.includes('android')) {
      setBiometricType('fingerprint');
    } else if (userAgent.includes('windows')) {
      setBiometricType('windows_hello');
    } else {
      setBiometricType('fingerprint');
    }
  };

  const handleBiometricAuth = async () => {
    setIsAuthenticating(true);
    setMessage(null);

    try {
      // Get device ID (browser fingerprint)
      const deviceId = getDeviceId();

      // Create credential request options
      const options: CredentialRequestOptions = {
        publicKey: {
          challenge: new Uint8Array(32), // This should be a random challenge from the server
          timeout: 60000,
          userVerification: 'preferred',
        },
      };

      // Authenticate using platform authenticator
      const assertion = await navigator.credentials.get(options);

      if (assertion && assertion instanceof PublicKeyCredential) {
        setMessageType('success');
        setMessage('Biometric authentication successful!');

        const biometricData = {
          type: biometricType,
          deviceId,
          credentialId: assertion.id,
          response: {
            clientJSON: JSON.stringify(
              (assertion.response as AuthenticatorAssertionResponse)
                .clientDataJSON
            ),
          },
        };

        onSuccess?.(biometricData);
      }
    } catch (error) {
      const errorMessage =
        error instanceof DOMException
          ? error.message
          : 'Biometric authentication failed';

      setMessageType('error');
      setMessage(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getDeviceId = (): string => {
    // Generate or retrieve a consistent device ID
    let deviceId = localStorage.getItem('deviceId');

    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem('deviceId', deviceId);
    }

    return deviceId;
  };

  const getBiometricLabel = () => {
    switch (biometricType) {
      case 'face_id':
        return 'Face ID';
      case 'fingerprint':
        return 'Fingerprint';
      case 'windows_hello':
        return 'Windows Hello';
      default:
        return 'Biometric';
    }
  };

  const getBiometricIcon = () => {
    switch (biometricType) {
      case 'face_id':
        return <Eye className="h-6 w-6" />;
      case 'fingerprint':
        return <Fingerprint className="h-6 w-6" />;
      case 'windows_hello':
        return <EyeOff className="h-6 w-6" />;
      default:
        return <Fingerprint className="h-6 w-6" />;
    }
  };

  if (!isBiometricAvailable) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-medium text-blue-900">
          {getBiometricIcon()}
          Unlock with {getBiometricLabel()}
        </h3>

        <p className="mb-4 text-sm text-blue-800">
          Use your {getBiometricLabel().toLowerCase()} to quickly unlock your
          wallet.
        </p>

        <Button
          onClick={handleBiometricAuth}
          disabled={isAuthenticating}
          size="lg"
          className="w-full"
          variant="outline"
        >
          {isAuthenticating ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              {getBiometricIcon()}
              <span className="ml-2">
                Use {getBiometricLabel()}
              </span>
            </>
          )}
        </Button>
      </div>

      {message && (
        <Alert
          className={
            messageType === 'success'
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }
        >
          {messageType === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription
            className={
              messageType === 'success' ? 'text-green-800' : 'text-red-800'
            }
          >
            {message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default BiometricUnlock;
