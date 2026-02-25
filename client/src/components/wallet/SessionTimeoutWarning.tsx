/**
 * Session Timeout Warning Component
 * Displays notification when session is expiring soon
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SessionTimeoutWarningProps {
  sessionToken?: string;
  expiresAt?: Date;
  warningThresholdMinutes?: number;
  onExtend?: () => void;
  onWarningShow?: () => void;
}

export const SessionTimeoutWarning: React.FC<
  SessionTimeoutWarningProps
> = ({
  sessionToken,
  expiresAt,
  warningThresholdMinutes = 30,
  onExtend,
  onWarningShow,
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState(0);
  const [isExtending, setIsExtending] = useState(false);

  useEffect(() => {
    if (!expiresAt || !sessionToken) return;

    const checkExpiry = async () => {
      try {
        const response = await fetch(
          `/api/sessions/expiry-check?sessionToken=${sessionToken}`,
          {
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();

          if (
            data.data.shouldShowWarning &&
            !showWarning
          ) {
            setShowWarning(true);
            onWarningShow?.();
          }

          setMinutesRemaining(data.data.minutesRemaining);
        }
      } catch (error) {
        console.error('Failed to check session expiry:', error);
      }
    };

    // Check every minute
    checkExpiry();
    const interval = setInterval(checkExpiry, 60000);

    return () => clearInterval(interval);
  }, [sessionToken, expiresAt, showWarning, onWarningShow]);

  const handleExtend = async () => {
    if (!sessionToken) return;

    setIsExtending(true);
    try {
      const response = await fetch('/api/sessions/extend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          sessionToken,
          autoExtend: true,
        }),
      });

      if (response.ok) {
        setShowWarning(false);
        onExtend?.();
      }
    } catch (error) {
      console.error('Failed to extend session:', error);
    } finally {
      setIsExtending(false);
    }
  };

  if (!showWarning) return null;

  return (
    <Alert className="mb-4 border-yellow-500 bg-yellow-50">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="ml-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              Your session will expire in {minutesRemaining} minutes
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExtend}
            disabled={isExtending}
            className="ml-4 flex items-center gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            {isExtending ? 'Extending...' : 'Extend Session'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default SessionTimeoutWarning;
