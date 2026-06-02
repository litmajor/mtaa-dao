
import { useMemo } from 'react';

interface DaoData {
  name: string;
  description: string;
  daoType?: string;
  category: string;
  members: any[];
  selectedElders: string[];
  quorum: number;
  treasuryType: string;
}

const VALIDATION_RULES = {
  name: { min: 3, max: 100 },
  description: { min: 20, max: 500 },
  minElders: 2,
  maxElders: 5,
  minQuorum: 20,
  minMembers: 2,
} as const;

export function useStepValidation(currentStep: number, daoData: DaoData) {
  return useMemo(() => {
    const errors: string[] = [];

    switch (currentStep) {
        case 1: // DAO Type
          if (!daoData.daoType) {
            errors.push('Please select a group type');
          }
          break;

        case 2: // Basic Info (only name required for compact onboarding)
          if (!daoData.name || daoData.name.length < VALIDATION_RULES.name.min) {
            errors.push(`Name must be at least ${VALIDATION_RULES.name.min} characters`);
          }
          if (daoData.name.length > VALIDATION_RULES.name.max) {
            errors.push(`Name cannot exceed ${VALIDATION_RULES.name.max} characters`);
          }
          break;

        case 3: // Members
          if (daoData.members.length < VALIDATION_RULES.minMembers) {
            errors.push(`Add at least ${VALIDATION_RULES.minMembers} members`);
          }
          break;

        case 4: // Contributions / Treasury
          if (!daoData.treasuryType) {
            errors.push('Please select how you will collect money');
          }
          break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [currentStep, daoData]);
}
