
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
          errors.push('Please select a DAO type');
        }
        break;

      case 2: // Basic Info
        if (!daoData.name || daoData.name.length < VALIDATION_RULES.name.min) {
          errors.push(`DAO name must be at least ${VALIDATION_RULES.name.min} characters`);
        }
        if (daoData.name.length > VALIDATION_RULES.name.max) {
          errors.push(`DAO name cannot exceed ${VALIDATION_RULES.name.max} characters`);
        }
        if (!daoData.description || daoData.description.length < VALIDATION_RULES.description.min) {
          errors.push(`Description must be at least ${VALIDATION_RULES.description.min} characters`);
        }
        if (!daoData.category) {
          errors.push('Please select a category');
        }
        break;

      case 3: // Elder Selection
        if (daoData.selectedElders.length < VALIDATION_RULES.minElders) {
          errors.push(`Select at least ${VALIDATION_RULES.minElders} elders`);
        }
        if (daoData.selectedElders.length > VALIDATION_RULES.maxElders) {
          errors.push(`Cannot select more than ${VALIDATION_RULES.maxElders} elders`);
        }
        break;

      case 4: // Governance
        if (daoData.quorum < VALIDATION_RULES.minQuorum) {
          errors.push(`Quorum must be at least ${VALIDATION_RULES.minQuorum}%`);
        }
        break;

      case 5: // Treasury
        if (!daoData.treasuryType) {
          errors.push('Please select a treasury type');
        }
        break;

      case 6: // Members
        if (daoData.members.length < VALIDATION_RULES.minMembers) {
          errors.push(`Add at least ${VALIDATION_RULES.minMembers} members`);
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [currentStep, daoData]);
}
