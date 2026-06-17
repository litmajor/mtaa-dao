import React from 'react';

export interface ModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen = true, onClose, title, children, className }) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${className || ''}`} role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black opacity-40" onClick={onClose} />
      <div className="bg-white rounded shadow-lg max-w-2xl w-full mx-4 p-6 z-10">
        {title && <div className="mb-4 font-semibold">{title}</div>}
        <div>{children}</div>
        {onClose && (
          <div className="mt-4 text-right">
            <button onClick={onClose} className="px-3 py-1 rounded bg-neutral-100">Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
