import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * Persona/Subprofile Context
 * Manages user's active subprofile (okedi/yuki/amara) with:
 * - Real-time switching between subprofiles
 * - Dashboard reorganization per subprofile
 * - Subprofile details and metadata
 * - Profile-specific preferences (expanded sections, scroll position, etc.)
 * - localStorage for immediate UI updates
 * - Backend API for persistent storage
 */

export type SubprofileType = 'okedi' | 'yuki' | 'amara';

export interface SubprofileDetails {
  id: SubprofileType;
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  focusAreas: string[];
  unlockPriorities: string[];
}

/**
 * Profile-specific preferences stored per subprofile
 * Allows dashboards to remember state across profile switches
 */
export interface SubprofilePreferences {
  expandedSections?: Record<string, boolean>; // Dashboard section expanded states
  scrollPosition?: number; // Dashboard scroll position
  selectedTab?: string; // Current tab in tabbed interfaces
  filters?: Record<string, any>; // Active filters
  sortOrder?: Record<string, 'asc' | 'desc'>; // Sort preferences per dashboard
  viewMode?: 'grid' | 'list' | 'compact'; // View preference
  customSettings?: Record<string, any>; // Profile-specific settings
}

interface PersonaContextType {
  activeSubprofile: SubprofileType | null;
  subprofileDetails: SubprofileDetails | null;
  preferences: SubprofilePreferences;
  isLoading: boolean;
  error: string | null;
  switchSubprofile: (subprofile: SubprofileType) => Promise<void>;
  refreshSubprofile: () => Promise<void>;
  updatePreferences: (key: keyof SubprofilePreferences, value: any) => void;
  getPreference: (key: keyof SubprofilePreferences) => any;
  clearError: () => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

const SUBPROFILE_STORAGE_KEY = 'mtaa_dao_active_subprofile';
const SUBPROFILE_DETAILS_KEY = 'mtaa_dao_subprofile_details';
const SUBPROFILE_PREFERENCES_KEY = 'mtaa_dao_subprofile_preferences'; // New: preferences storage key
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * PersonaProvider Component
 * Wraps app to provide subprofile context to all children
 */
export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [activeSubprofile, setActiveSubprofile] = useState<SubprofileType | null>(null);
  const [subprofileDetails, setSubprofileDetails] = useState<SubprofileDetails | null>(null);
  const [preferences, setPreferences] = useState<SubprofilePreferences>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load preferences for a specific subprofile
   */
  const loadPreferencesForProfile = useCallback((subprofile: SubprofileType) => {
    try {
      const stored = localStorage.getItem(`${SUBPROFILE_PREFERENCES_KEY}_${subprofile}`);
      return stored ? JSON.parse(stored) : {};
    } catch (err) {
      console.error(`Failed to load preferences for ${subprofile}:`, err);
      return {};
    }
  }, []);

  /**
   * Save preferences for a specific subprofile
   */
  const savePreferencesForProfile = useCallback((subprofile: SubprofileType, prefs: SubprofilePreferences) => {
    try {
      localStorage.setItem(`${SUBPROFILE_PREFERENCES_KEY}_${subprofile}`, JSON.stringify(prefs));
    } catch (err) {
      console.error(`Failed to save preferences for ${subprofile}:`, err);
    }
  }, []);

  /**
   * Update a specific preference
   */
  const updatePreferences = useCallback((key: keyof SubprofilePreferences, value: any) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      // Save to localStorage immediately
      if (activeSubprofile) {
        savePreferencesForProfile(activeSubprofile, updated);
      }
      return updated;
    });
  }, [activeSubprofile, savePreferencesForProfile]);

  /**
   * Get a specific preference value
   */
  const getPreference = useCallback((key: keyof SubprofilePreferences) => {
    return preferences[key];
  }, [preferences]);

  /**
   * Fetch current active subprofile from backend
   */
  const refreshSubprofile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/personas/subprofile/active`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setActiveSubprofile(null);
          setSubprofileDetails(null);
          return;
        }
        throw new Error(`Failed to fetch active subprofile: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store in localStorage for immediate availability
      if (data.activeSubprofile) {
        localStorage.setItem(SUBPROFILE_STORAGE_KEY, data.activeSubprofile);
        setActiveSubprofile(data.activeSubprofile);

        if (data.details) {
          localStorage.setItem(SUBPROFILE_DETAILS_KEY, JSON.stringify(data.details));
          setSubprofileDetails(data.details);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh subprofile';
      setError(errorMessage);
      console.error('Subprofile refresh error:', err);
      
      // Fall back to localStorage
      const stored = localStorage.getItem(SUBPROFILE_STORAGE_KEY);
      if (stored) {
        setActiveSubprofile(stored as SubprofileType);
        const storedDetails = localStorage.getItem(SUBPROFILE_DETAILS_KEY);
        if (storedDetails) {
          setSubprofileDetails(JSON.parse(storedDetails));
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Switch to a different subprofile
   */
  const switchSubprofile = useCallback(
    async (subprofile: SubprofileType) => {
      try {
        setIsLoading(true);
        setError(null);

        // Optimistic update
        setActiveSubprofile(subprofile);
        localStorage.setItem(SUBPROFILE_STORAGE_KEY, subprofile);

        // Load preferences for this profile
        const profilePrefs = loadPreferencesForProfile(subprofile);
        setPreferences(profilePrefs);

        // Send to backend
        const response = await fetch(`${API_BASE_URL}/personas/subprofile/switch`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subprofile }),
        });

        if (!response.ok) {
          throw new Error(`Failed to switch subprofile: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.details) {
          localStorage.setItem(SUBPROFILE_DETAILS_KEY, JSON.stringify(data.details));
          setSubprofileDetails(data.details);
        }

        // Trigger dashboard reorganization
        window.dispatchEvent(new CustomEvent('subprofile-changed', { detail: { subprofile } }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to switch subprofile';
        setError(errorMessage);
        console.error('Subprofile switch error:', err);

        // Revert optimistic update on error
        await refreshSubprofile();
      } finally {
        setIsLoading(false);
      }
    },
    [refreshSubprofile, loadPreferencesForProfile]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Load subprofile on mount
   */
  useEffect(() => {
    // Check localStorage first for immediate load
    const storedSubprofile = localStorage.getItem(SUBPROFILE_STORAGE_KEY) as SubprofileType | null;
    const storedDetails = localStorage.getItem(SUBPROFILE_DETAILS_KEY);

    if (storedSubprofile) {
      setActiveSubprofile(storedSubprofile);
      if (storedDetails) {
        setSubprofileDetails(JSON.parse(storedDetails));
      }
      // Load preferences for this profile
      const profilePrefs = loadPreferencesForProfile(storedSubprofile);
      setPreferences(profilePrefs);
    }

    // Then sync with backend
    refreshSubprofile();
  }, [refreshSubprofile, loadPreferencesForProfile]);

  const value: PersonaContextType = {
    activeSubprofile,
    subprofileDetails,
    preferences,
    isLoading,
    error,
    switchSubprofile,
    refreshSubprofile,
    updatePreferences,
    getPreference,
    clearError,
  };

  return (
    <PersonaContext.Provider value={value}>
      {children}
    </PersonaContext.Provider>
  );
}

/**
 * Hook to use Persona context
 * Must be used within PersonaProvider
 */
export function usePersona(): PersonaContextType {
  const context = useContext(PersonaContext);
  if (context === undefined) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return context;
}

/**
 * Hook to get active subprofile only
 */
export function useActiveSubprofile(): SubprofileType | null {
  const { activeSubprofile } = usePersona();
  return activeSubprofile;
}

/**
 * Hook to get subprofile details only
 */
export function useSubprofileDetails(): SubprofileDetails | null {
  const { subprofileDetails } = usePersona();
  return subprofileDetails;
}

/**
 * Hook to access and update profile-specific preferences
 * Example: const { preferences, updatePreferences } = useSubprofilePreferences();
 */
export function useSubprofilePreferences() {
  const { preferences, updatePreferences, getPreference } = usePersona();
  return {
    preferences,
    updatePreferences,
    getPreference,
    // Convenience methods for common operations
    setExpandedSection: (sectionId: string, expanded: boolean) => {
      updatePreferences('expandedSections', {
        ...(preferences.expandedSections || {}),
        [sectionId]: expanded,
      });
    },
    isExpanded: (sectionId: string) => {
      return preferences.expandedSections?.[sectionId] ?? true; // default expanded
    },
    setScrollPosition: (position: number) => {
      updatePreferences('scrollPosition', position);
    },
    getScrollPosition: () => {
      return preferences.scrollPosition ?? 0;
    },
    setSelectedTab: (tab: string) => {
      updatePreferences('selectedTab', tab);
    },
    getSelectedTab: () => {
      return preferences.selectedTab;
    },
  };
}
