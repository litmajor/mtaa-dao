import React, { useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import useToast from '@/components/ui/use-toast';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

/**
 * AlertToastManager Component
 * Real-time alert notification system powered by WebSocket events
 * Listens to alert:new events from backend and displays them as toasts
 *
 * Alert severity levels:
 * - critical: Red error toast (5s duration)
 * - high: Yellow warning toast (5s duration)
 * - medium: Blue info toast (4s duration)
 * - low: Default info toast (3s duration)
 */
export const AlertToastManager: React.FC = () => {
  const { socket, isConnected } = useWebSocket();
  const { toast } = useToast();

  useEffect(() => {
    if (!isConnected) return;

    const handleNewAlert = (data: {
      alertType: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      id: string;
      metadata?: Record<string, any>;
      timestamp?: string;
    }) => {
      // Map severity to toast configuration
      const severityConfig = {
        critical: {
          type: 'error' as const,
          duration: 5000,
          title: '🚨 CRITICAL ALERT'
        },
        high: {
          type: 'warning' as const,
          duration: 5000,
          title: '⚠️ WARNING'
        },
        medium: {
          type: 'info' as const,
          duration: 4000,
          title: 'ℹ️ NOTIFICATION'
        },
        low: {
          type: 'info' as const,
          duration: 3000,
          title: '📋 INFO'
        }
      };

      const config = severityConfig[data.severity];

      // Build description with metadata if available
      let description = data.message;
      if (data.metadata?.entityType) {
        description += ` [${data.metadata.entityType}]`;
        if (data.metadata.entityId) {
          description += ` #${data.metadata.entityId}`;
        }
      }

      // Display the toast
      toast({
        title: `${config.title} - ${data.alertType}`,
        description,
        type: config.type,
        duration: config.duration,
        variant: data.severity === 'critical' ? 'destructive' : 'default'
      });
    };

    // Listen to alert:new event
    socket.on('alert:new', handleNewAlert);

    // Cleanup
    return () => socket.off('alert:new', handleNewAlert);
  }, [socket, isConnected, toast]);

  // This component has no visual output (just manages alerts)
  return null;
};

export default AlertToastManager;
