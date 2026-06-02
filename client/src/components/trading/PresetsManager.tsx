import React, { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { FilterPreset } from '@/hooks/useTradingFilters';

interface PresetsManagerProps {
  presets: FilterPreset[];
  onLoadPreset: (name: string) => void;
  onSavePreset: (name: string, description?: string) => void;
  onDeletePreset: (name: string) => void;
}

/**
 * Presets Manager: Save and load filter combinations
 * 
 * Allows users to:
 * - Save current filters as named preset
 * - Load saved presets quickly
 * - Delete presets
 * - Add descriptions to presets
 */
export const PresetsManager: React.FC<PresetsManagerProps> = ({
  presets,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
}) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveFormData, setSaveFormData] = useState({ name: '', description: '' });

  const handleSave = () => {
    if (saveFormData.name.trim()) {
      onSavePreset(saveFormData.name, saveFormData.description);
      setSaveFormData({ name: '', description: '' });
      setShowSaveDialog(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-300 flex items-center gap-2">
          💾 Presets
        </h3>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition-colors flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Save
        </button>
      </div>

      {/* Presets List */}
      <div className="space-y-2">
        {presets.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No presets saved yet</p>
        ) : (
          presets.map((preset) => (
            <div
              key={preset.name}
              className="flex items-center justify-between p-2 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors group"
            >
              <button
                onClick={() => onLoadPreset(preset.name)}
                className="flex-1 text-left"
              >
                <p className="text-sm font-semibold text-slate-200">{preset.name}</p>
                {preset.description && (
                  <p className="text-xs text-slate-400 truncate">{preset.description}</p>
                )}
                <p className="text-xs text-slate-500">
                  {new Date(preset.createdAt).toLocaleDateString()}
                </p>
              </button>
              <button
                onClick={() => onDeletePreset(preset.name)}
                className="p-1 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete preset"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-sm w-full border border-slate-700">
            <h3 className="font-bold mb-4">Save Filter Preset</h3>

            <input
              type="text"
              placeholder="Preset name"
              value={saveFormData.name}
              onChange={(e) => setSaveFormData({ ...saveFormData, name: e.target.value })}
              className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-sm mb-3 focus:outline-none focus:border-blue-500"
              autoFocus
            />

            <textarea
              placeholder="Description (optional)"
              value={saveFormData.description}
              onChange={(e) => setSaveFormData({ ...saveFormData, description: e.target.value })}
              className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-sm mb-4 resize-none focus:outline-none focus:border-blue-500"
              rows={2}
            />

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!saveFormData.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded font-semibold text-sm transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
