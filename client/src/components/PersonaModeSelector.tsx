import React from 'react';
import { usePersona, SubprofileType } from '../contexts/persona-context';

/**
 * PersonaModeSelector Component
 * Allows users to switch between subprofiles (okedi/yuki/amara)
 * Displays in Settings and other places where users manage preferences
 * 
 * All features are accessible from any subprofile - this just switches the dashboard layout
 */

export interface PersonaModeOption {
  id: SubprofileType;
  name: string;
  displayName: string;
  role: string;
  description: string;
  icon: string;
  color: string;
}

const SUBPROFILE_OPTIONS: PersonaModeOption[] = [
  {
    id: 'okedi',
    name: 'MTAA Community',
    displayName: 'Okedi',
    role: 'Community Leader & Governor',
    description: 'Focus on governance, create proposals, lead DAOs',
    icon: '🎤',
    color: '#8B5CF6',
  },
  {
    id: 'yuki',
    name: 'MTAA Trader',
    displayName: 'Yuki',
    role: 'Advanced Trader & Developer',
    description: 'Focus on trading, yield farming, smart contracts',
    icon: '🛠️',
    color: '#06B6D4',
  },
  {
    id: 'amara',
    name: 'MTAA Investor',
    displayName: 'Amara',
    role: 'Wealth Builder & Investor',
    description: 'Focus on passive income and wealth growth',
    icon: '💰',
    color: '#EC4899',
  },
];

interface PersonaModeSelectorProps {
  /**
   * Whether to show in compact mode (for settings header)
   * or full mode (for onboarding, detailed selection)
   */
  variant?: 'compact' | 'full' | 'cards';
  /**
   * Optional callback when subprofile changes
   */
  onChanged?: (subprofile: SubprofileType) => void;
  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;
}

/**
 * Compact Mode: Small inline selector (dropdown or button group)
 */
function CompactSelector({
  activeSubprofile,
  onSwitch,
  disabled,
}: {
  activeSubprofile: SubprofileType | null;
  onSwitch: (subprofile: SubprofileType) => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {SUBPROFILE_OPTIONS.map((option) => (
        <button
          key={option.id}
          onClick={() => !disabled && onSwitch(option.id)}
          disabled={disabled}
          className={`
            px-3 py-1 rounded-md text-sm font-medium
            transition-all duration-200
            ${
              activeSubprofile === option.id
                ? 'bg-opacity-100 text-white ring-2 ring-offset-2'
                : 'bg-opacity-10 text-gray-700 hover:bg-opacity-20'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          style={
            activeSubprofile === option.id
              ? {
                  backgroundColor: option.color,
                  ringColor: option.color,
                }
              : {
                  backgroundColor: option.color,
                }
          }
          title={option.role}
        >
          <span>{option.icon} {option.displayName}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Full Mode: Detailed selector with descriptions
 */
function FullSelector({
  activeSubprofile,
  onSwitch,
  disabled,
}: {
  activeSubprofile: SubprofileType | null;
  onSwitch: (subprofile: SubprofileType) => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Select Your Subprofile</p>
      <p className="text-xs text-gray-500">
        Switch between subprofiles anytime. All features accessible from any subprofile - dashboard just reorganizes.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SUBPROFILE_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => !disabled && onSwitch(option.id)}
            disabled={disabled}
            className={`
              p-4 rounded-lg border-2 text-left transition-all duration-200
              ${
                activeSubprofile === option.id
                  ? 'border-opacity-100 bg-opacity-5'
                  : 'border-gray-200 hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            style={
              activeSubprofile === option.id
                ? {
                    borderColor: option.color,
                    backgroundColor: option.color,
                  }
                : {}
            }
          >
            <div className="text-2xl mb-2">{option.icon}</div>
            <div className="font-semibold text-gray-900">{option.name}</div>
            <div className="text-xs font-medium mb-2" style={{ color: option.color }}>
              {option.displayName}
            </div>
            <div className="text-sm text-gray-600">{option.role}</div>
            <div className="text-xs text-gray-500 mt-2">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Cards Mode: Large detailed cards (for onboarding)
 */
function CardsSelector({
  activeSubprofile,
  onSwitch,
  disabled,
}: {
  activeSubprofile: SubprofileType | null;
  onSwitch: (subprofile: SubprofileType) => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Choose Your Subprofile</h2>
        <p className="text-gray-600 mt-2">
          All features are available in any subprofile. This just organizes your dashboard.
        </p>
        <p className="text-sm text-gray-500 mt-2">You can switch anytime in Settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SUBPROFILE_OPTIONS.map((option) => (
          <div
            key={option.id}
            onClick={() => !disabled && onSwitch(option.id)}
            className={`
              p-6 rounded-xl border-2 cursor-pointer transition-all duration-200
              ${
                activeSubprofile === option.id
                  ? 'ring-2 ring-offset-2 shadow-lg'
                  : 'hover:shadow-md border-gray-200'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            style={
              activeSubprofile === option.id
                ? {
                    borderColor: option.color,
                    backgroundColor: `${option.color}10`,
                    ringColor: option.color,
                  }
                : {}
            }
          >
            {/* Selected Checkmark */}
            {activeSubprofile === option.id && (
              <div
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold mb-4 ml-auto"
                style={{ backgroundColor: option.color }}
              >
                ✓
              </div>
            )}

            {/* Icon and Name */}
            <div className="text-4xl mb-4">{option.icon}</div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">{option.name}</h3>
            <p className="text-sm font-medium mb-3" style={{ color: option.color }}>
              {option.displayName} • {option.role}
            </p>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-4">{option.description}</p>

            {/* Features List */}
            <div className="text-xs space-y-1 mb-4 text-gray-500">
              {option.id === 'okedi' && (
                <>
                  <div>✓ Create & govern DAOs</div>
                  <div>✓ Create proposals</div>
                  <div>✓ Vote on governance</div>
                  <div>✓ Lead communities</div>
                </>
              )}
              {option.id === 'yuki' && (
                <>
                  <div>✓ Trade on DEX</div>
                  <div>✓ Yield farming</div>
                  <div>✓ Smart contracts</div>
                  <div>✓ Leverage trading</div>
                </>
              )}
              {option.id === 'amara' && (
                <>
                  <div>✓ Investment pools</div>
                  <div>✓ Passive income</div>
                  <div>✓ Wealth tracking</div>
                  <div>✓ Portfolio optimization</div>
                </>
              )}
            </div>

            {/* Button */}
            <button
              className="w-full py-2 rounded-lg font-medium text-sm transition-all duration-200"
              style={
                activeSubprofile === option.id
                  ? {
                      backgroundColor: option.color,
                      color: 'white',
                    }
                  : {
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                    }
              }
            >
              {activeSubprofile === option.id ? 'Active' : 'Select'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main PersonaModeSelector Component
 */
export function PersonaModeSelector({
  variant = 'full',
  onChanged,
  disabled = false,
}: PersonaModeSelectorProps) {
  const { activeSubprofile, isLoading, switchSubprofile, error } = usePersona();

  const handleSwitch = async (subprofile: SubprofileType) => {
    try {
      await switchSubprofile(subprofile);
      onChanged?.(subprofile);
    } catch (err) {
      console.error('Failed to switch subprofile:', err);
    }
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {variant === 'compact' && (
        <CompactSelector
          activeSubprofile={activeSubprofile}
          onSwitch={handleSwitch}
          disabled={disabled || isLoading}
        />
      )}

      {variant === 'full' && (
        <FullSelector
          activeSubprofile={activeSubprofile}
          onSwitch={handleSwitch}
          disabled={disabled || isLoading}
        />
      )}

      {variant === 'cards' && (
        <CardsSelector
          activeSubprofile={activeSubprofile}
          onSwitch={handleSwitch}
          disabled={disabled || isLoading}
        />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="text-sm text-gray-500">Switching subprofile...</div>
        </div>
      )}
    </div>
  );
}
