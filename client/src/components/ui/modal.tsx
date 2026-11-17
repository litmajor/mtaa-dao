import React, { useEffect } from 'react';

export interface ModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, onOpenChange, children }) => {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => onOpenChange?.(false)} />
      <div className="relative bg-card text-card-foreground border border-border rounded-xl p-6 z-10 shadow-2xl max-w-lg w-full animate-in fade-in zoom-in-95">{children}</div>
    </div>
  );
};

export default Modal;
