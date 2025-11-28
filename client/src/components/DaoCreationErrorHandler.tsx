
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';

interface DaoCreationError {
  field?: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface DaoCreationErrorHandlerProps {
  errors: DaoCreationError[];
  onDismiss?: (index: number) => void;
}

/**
 * User-friendly error messages for common DAO creation issues
 */
const ERROR_TRANSLATIONS: Record<string, string> = {
  'name: String must contain at least 3': 'Your DAO name is too short. Please use at least 3 characters so members can recognize it.',
  'description: String must contain at least 20': 'Please write a longer description (at least 20 characters) to help members understand what this DAO is about.',
  'elders: Array must contain at least 2': 'For security, you need at least 2 trusted elders who can help manage the DAO. Think of them like co-signatories in a bank account.',
  'quorum: Number must be greater than or equal to 20': 'Quorum must be at least 20% to ensure enough members participate in decisions.',
  'User not authenticated': 'Your session has expired. Please log in again to continue creating your DAO.',
  'Please wait at least 1 hour': 'To prevent spam, you can only create one DAO per hour. Please try again in a few minutes.',
  'One or more selected elders': 'One of your selected elders cannot be added. They may need to verify their account first.',
  'Required signatures cannot exceed': 'You\'ve asked for more approval signatures than you have elders. Please reduce the number or add more elders.',
  'Voting period must be at least 24 hours': 'Give members at least 24 hours to vote so everyone has time to participate.',
  'Your account is suspended': 'Your account has been temporarily suspended. Please contact support@mtaadao.com for help.',
};

/**
 * Translates technical errors into user-friendly messages
 */
function translateError(error: string): string {
  for (const [key, translation] of Object.entries(ERROR_TRANSLATIONS)) {
    if (error.includes(key)) {
      return translation;
    }
  }
  return error; // Return original if no translation found
}

export function DaoCreationErrorHandler({ errors, onDismiss }: DaoCreationErrorHandlerProps) {
  if (errors.length === 0) return null;

  return (
    <div className="space-y-2">
      {errors.map((error, index) => (
        <Alert 
          key={index}
          variant={error.severity === 'error' ? 'destructive' : 'default'}
          className={error.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' : ''}
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error.field && <span className="font-semibold">{error.field}: </span>}
            {translateError(error.message)}
          </AlertDescription>
          {onDismiss && (
            <button
              onClick={() => onDismiss(index)}
              className="absolute right-2 top-2 rounded-sm opacity-70 hover:opacity-100"
            >
              ×
            </button>
          )}
        </Alert>
      ))}
    </div>
  );
}
