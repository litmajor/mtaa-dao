import React from 'react';
import MultisigWizard from '../multisig/MultisigWizard';

interface CreateMultisigModalProps {
  isOpen: boolean;
  daoId?: string;
  initialSigners?: string[];
  onClose: () => void;
  onCreated?: (multisig: any) => void;
}

export default function CreateMultisigModal({ isOpen, daoId, initialSigners = [], onClose, onCreated }: CreateMultisigModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <MultisigWizard daoId={daoId} initialSigners={initialSigners} onClose={onClose} onCreated={onCreated} />
    </div>
  );
}
