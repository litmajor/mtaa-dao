import React from 'react';

export interface ModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen = true, onClose, title, children, className }) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${className || ''}`} role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-2xl w-full mx-4 p-6 z-10 animate-in fade-in zoom-in-95">
        {title && <div className="mb-4 font-semibold text-lg text-foreground">{title}</div>}
        <div className="text-foreground">{children}</div>
        {onClose && (
          <div className="mt-6 text-right">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:opacity-90 font-medium text-sm transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
