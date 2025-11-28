
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, DollarSign, Users } from 'lucide-react';

interface DaoCreationConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  daoData: {
    name: string;
    daoType: string;
    elderCount: number;
    treasuryType: string;
    estimatedCost?: string;
  };
  isDeploying: boolean;
}

/**
 * Final confirmation dialog before deploying DAO to blockchain
 * Shows warnings about permanence and costs
 */
export function DaoCreationConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  daoData,
  isDeploying
}: DaoCreationConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Final Check Before Creating DAO
          </DialogTitle>
          <DialogDescription>
            Please review carefully - this action is permanent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* DAO Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">DAO Name:</span>
              <span className="text-sm">{daoData.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Type:</span>
              <span className="text-sm capitalize">{daoData.daoType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Elders:</span>
              <span className="text-sm">{daoData.elderCount} trusted members</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Treasury:</span>
              <span className="text-sm uppercase">{daoData.treasuryType}</span>
            </div>
          </div>

          {/* Critical Warnings */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>⚠️ This is permanent and cannot be undone</strong>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• DAO will be created on the blockchain (permanent record)</li>
                <li>• You cannot delete or rename it later</li>
                <li>• Elder permissions are set now and hard to change</li>
                <li>• All transactions will be publicly visible</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Cost Warning */}
          {daoData.estimatedCost && (
            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Estimated deployment cost:</strong> {daoData.estimatedCost}
                <br />
                <span className="text-xs text-gray-600">
                  This is a one-time blockchain transaction fee. Future operations will have minimal fees.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Responsibilities */}
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>As the founder, you'll need to:</strong>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• Invite and approve initial members (~30 min)</li>
                <li>• Review proposals and help make decisions (~30 min/week)</li>
                <li>• Respond to member questions and disputes</li>
                <li>• Coordinate with elders on withdrawals</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeploying}
            className="w-full sm:w-auto"
          >
            Wait, Let Me Review Again
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeploying}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
          >
            {isDeploying ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Creating DAO...
              </>
            ) : (
              'Yes, Create My DAO'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
