import React from "react";

interface ClaimTaskModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskTitle: string;
  loading?: boolean;
}

export const ClaimTaskModal: React.FC<ClaimTaskModalProps> = ({
  open,
  onClose,
  onConfirm,
  taskTitle,
  loading = false,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-2">Claim Task</h3>
        <p className="mb-4">Are you sure you want to claim <span className="font-semibold">{taskTitle}</span>?</p>
        <div className="flex justify-end space-x-2">
          <button
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Claiming..." : "Confirm Claim"}
          </button>
        </div>
      </div>
    </div>
  );
};
