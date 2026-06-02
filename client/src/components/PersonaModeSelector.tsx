import React, { useState, useEffect } from 'react';
import { usePersona, SubprofileType } from '../contexts/persona-context';
import { Lucide } from '../lib/icons';
const { Mic, Wrench, DollarSign, Check } = (Lucide as any) || {};
/* eslint-disable */

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
  icon: string | React.ReactNode;
  color: string;
  features?: string[];
}

const SUBPROFILE_OPTIONS: PersonaModeOption[] = [
  {
    id: 'okedi',
    name: 'MTAA Community',
    displayName: 'Okedi',
    role: 'Community Leader & Governor',
    description: 'Focus on governance, create proposals, lead DAOs',
    icon: Mic ? <Mic className="w-8 h-8" /> : '🎤',
    color: '#8B5CF6',
    features: ['Create & govern DAOs', 'Create proposals', 'Vote on governance', 'Lead communities'],
  },
  {
    id: 'yuki',
    name: 'MTAA Trader',
    displayName: 'Yuki',
    role: 'Advanced Trader & Developer',
    description: 'Focus on trading, yield farming, smart contracts',
    icon: Wrench ? <Wrench className="w-8 h-8" /> : '🛠️',
    color: '#06B6D4',
    features: ['Trade on DEX', 'Yield farming', 'Smart contracts', 'Leverage trading'],
  },
  {
    id: 'amara',
    name: 'MTAA Investor',
    displayName: 'Amara',
    role: 'Wealth Builder & Investor',
    description: 'Focus on passive income and wealth growth',
    icon: DollarSign ? <DollarSign className="w-8 h-8" /> : '💰',
    color: '#EC4899',
    features: ['Investment pools', 'Passive income', 'Wealth tracking', 'Portfolio optimization'],
  },
];

// Utility: convert hex color to rgba string with alpha
function hexToRgba(hex: string, alpha = 1) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
              data-color={option.color}
              data-active={activeSubprofile === option.id}
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
        {SUBPROFILE_OPTIONS.map((option) => {
          const isActive = activeSubprofile === option.id;
          return isActive ? (
            <button
              key={option.id}
              type="button"
              onClick={() => !disabled && onSwitch(option.id)}
              disabled={disabled}
              aria-pressed="true"
              className={`
                p-4 rounded-lg border-2 text-left transition-all duration-200 focus:outline-none
                ${
                  'border-opacity-100'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
                  data-color={option.color}
                  data-active={true}
            >
              <div className="text-2xl mb-2">{option.icon}</div>
              <div className="font-semibold text-gray-900">{option.name}</div>
              {/* eslint-disable-next-line */}
                  <div className="text-xs font-medium mb-2" data-color={option.color}>
                {option.displayName}
              </div>
              <div className="text-sm text-gray-600">{option.role}</div>
              <div className="text-xs text-gray-500 mt-2">{option.description}</div>
            </button>
          ) : (
            <button
              key={option.id}
              type="button"
              onClick={() => !disabled && onSwitch(option.id)}
              disabled={disabled}
              aria-pressed="false"
              className={`
                p-4 rounded-lg border-2 text-left transition-all duration-200 focus:outline-none
                ${
                  'border-gray-200 hover:border-gray-300'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
                  data-active={false}
            >
              <div className="text-2xl mb-2">{option.icon}</div>
              <div className="font-semibold text-gray-900">{option.name}</div>
              {/* eslint-disable-next-line */}
                  <div className="text-xs font-medium mb-2" data-color={option.color}>
                {option.displayName}
              </div>
              <div className="text-sm text-gray-600">{option.role}</div>
              <div className="text-xs text-gray-500 mt-2">{option.description}</div>
            </button>
          );
        })}
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
        {SUBPROFILE_OPTIONS.map((option) => {
          const isActive = activeSubprofile === option.id;
          return isActive ? (
            <button
              key={option.id}
              type="button"
              onClick={() => !disabled && onSwitch(option.id)}
              disabled={disabled}
              aria-pressed="true"
              className={`p-6 rounded-xl border-2 transition-all duration-200 text-left focus:outline-none shadow-lg ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  data-color={option.color}
                  data-active={true}
            >
              {/* active indicator */}
              {/* eslint-disable-next-line */}
                  <div
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold mb-4 ml-auto"
                    data-color={option.color}
                  >
                {Check ? <Check className="w-3 h-3" /> : '✓'}
              </div>

              {/* Icon and Name */}
              <div className="text-4xl mb-4">{option.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{option.name}</h3>
              {/* eslint-disable-next-line */}
                  <p className="text-sm font-medium mb-3" data-color={option.color}>
                {option.displayName} • {option.role}
              </p>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4">{option.description}</p>

              {/* Features List (data-driven) */}
              <div className="text-xs space-y-1 mb-4 text-gray-500">
                {option.features?.map((f) => (
                  <div key={f} className="flex items-center gap-2"><span>{Check ? <Check className="w-3 h-3 text-green-600" /> : '✓'}</span><span>{f}</span></div>
                ))}
              </div>

              {/* Label */}
              <div
                className={`w-full py-2 rounded-lg font-medium text-sm text-center transition-all duration-200 text-white`}
                    data-color={option.color}
                    data-active={true}
              >
                Active
              </div>
            </button>
          ) : (
            <button
              key={option.id}
              type="button"
              onClick={() => !disabled && onSwitch(option.id)}
              disabled={disabled}
              aria-pressed="false"
              className={`p-6 rounded-xl border-2 transition-all duration-200 text-left focus:outline-none hover:shadow-md border-gray-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  data-active={false}
            >
              {/* Icon and Name */}
              <div className="text-4xl mb-4">{option.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{option.name}</h3>
              {/* eslint-disable-next-line */}
                  <p className="text-sm font-medium mb-3" data-color={option.color}>
                {option.displayName} • {option.role}
              </p>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4">{option.description}</p>

              {/* Features List (data-driven) */}
              <div className="text-xs space-y-1 mb-4 text-gray-500">
                {option.features?.map((f) => (
                  <div key={f} className="flex items-center gap-2"><span>{Check ? <Check className="w-3 h-3 text-green-600" /> : '✓'}</span><span>{f}</span></div>
                ))}
              </div>

              {/* Label */}
              <div
                className={`w-full py-2 rounded-lg font-medium text-sm text-center transition-all duration-200 text-gray-700`}
                    data-active={false}
              >
                Select
              </div>
            </button>
          );
        })}
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
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocalError(error || null);
  }, [error]);

  const handleSwitch = async (subprofile: SubprofileType) => {
    if (disabled || isLoading) return;
    try {
      await switchSubprofile(subprofile);
      setLocalError(null);
      onChanged?.(subprofile);
    } catch (err: any) {
      console.error('Failed to switch subprofile:', err);
      setLocalError(err?.message || 'Failed to switch subprofile');
    }
  };

  return (
    <div className="w-full">
      {localError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {localError}
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
