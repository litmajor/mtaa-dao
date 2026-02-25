import React, { useState, useEffect } from 'react';
import styles from './config-editor.module.css';

interface ConfigField {
  name: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'textarea';
  label: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  validation?: (value: any) => { valid: boolean; error?: string };
  help?: string;
}

interface ConfigEditorProps {
  title: string;
  entityType: 'elder' | 'agent' | 'system';
  entityId?: string;
  entityName?: string;
  fields: ConfigField[];
  initialValues: Record<string, any>;
  onSave: (values: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  isDirty?: boolean;
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
  title,
  entityType,
  entityId,
  entityName,
  fields,
  initialValues,
  onSave,
  onCancel,
  isDirty: externalIsDirty,
}) => {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(externalIsDirty || false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const validateField = (field: ConfigField, value: any): string | undefined => {
    // Required field
    if (field.required && !value) {
      return `${field.label} is required`;
    }

    // Type validation
    if (value !== undefined && value !== '') {
      switch (field.type) {
        case 'number':
          if (isNaN(Number(value))) {
            return `${field.label} must be a number`;
          }
          if (field.min !== undefined && Number(value) < field.min) {
            return `${field.label} must be at least ${field.min}`;
          }
          if (field.max !== undefined && Number(value) > field.max) {
            return `${field.label} must be at most ${field.max}`;
          }
          break;

        case 'text':
          if (typeof value !== 'string') {
            return `${field.label} must be text`;
          }
          break;

        case 'select':
          if (field.options && !field.options.find((opt) => opt.value === value)) {
            return `Invalid selection for ${field.label}`;
          }
          break;
      }
    }

    // Custom validation
    if (field.validation) {
      const result = field.validation(value);
      if (!result.valid) {
        return result.error;
      }
    }

    return undefined;
  };

  const handleChange = (fieldName: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
    setIsDirty(true);

    // Validate on change if field has been touched
    if (touched[fieldName]) {
      const field = fields.find((f) => f.name === fieldName);
      if (field) {
        const error = validateField(field, value);
        setErrors((prev) => ({
          ...prev,
          [fieldName]: error,
        }));
      }
    }
  };

  const handleBlur = (fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));

    const field = fields.find((f) => f.name === fieldName);
    if (field) {
      const error = validateField(field, values[fieldName]);
      setErrors((prev) => ({
        ...prev,
        [fieldName]: error,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      const error = validateField(field, values[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setErrorMessage('Please fix the errors below');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await onSave(values);
      setIsDirty(false);
      setSuccessMessage(`Configuration updated successfully for ${entityName || entityType}`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsDirty(false);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{title}</h2>
        {entityName && <p className={styles.subtitle}>{entityName}</p>}
      </div>

      {successMessage && <div className={`${styles.message} ${styles.success}`}>{successMessage}</div>}
      {errorMessage && <div className={`${styles.message} ${styles.error}`}>{errorMessage}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldsContainer}>
          {fields.map((field) => (
            <div key={field.name} className={styles.formGroup}>
              <label htmlFor={field.name} className={styles.label}>
                {field.label}
                {field.required && <span className={styles.required}>*</span>}
              </label>

              {field.type === 'boolean' ? (
                <div className={styles.checkboxWrapper}>
                  <input
                    id={field.name}
                    type="checkbox"
                    checked={values[field.name] || false}
                    onChange={(e) => handleChange(field.name, e.target.checked)}
                    onBlur={() => handleBlur(field.name)}
                    className={styles.checkbox}
                  />
                  <span className={styles.checkboxLabel}>{field.help || 'Enable this option'}</span>
                </div>
              ) : field.type === 'select' ? (
                <select
                  id={field.name}
                  value={values[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  onBlur={() => handleBlur(field.name)}
                  className={`${styles.input} ${errors[field.name] ? styles.invalid : ''}`}
                >
                  <option value="">{field.placeholder || `Select ${field.label.toLowerCase()}`}</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  id={field.name}
                  value={values[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  onBlur={() => handleBlur(field.name)}
                  placeholder={field.placeholder}
                  className={`${styles.textarea} ${errors[field.name] ? styles.invalid : ''}`}
                  rows={4}
                />
              ) : (
                <input
                  id={field.name}
                  type={field.type}
                  value={values[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  onBlur={() => handleBlur(field.name)}
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  className={`${styles.input} ${errors[field.name] ? styles.invalid : ''}`}
                />
              )}

              {field.help && field.type !== 'boolean' && (
                <p className={styles.help}>{field.help}</p>
              )}
              {errors[field.name] && (
                <p className={styles.errorText}>{errors[field.name]}</p>
              )}
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={onCancel}
            className={styles.buttonCancel}
            disabled={loading}
          >
            Close
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={handleReset}
              className={styles.buttonReset}
              disabled={loading}
            >
              Reset Changes
            </button>
          )}
          <button
            type="submit"
            className={styles.buttonSave}
            disabled={loading || !isDirty}
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigEditor;
