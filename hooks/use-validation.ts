'use client';

import { useState, useCallback } from 'react';

export interface ValidationRule<T = any> {
  validate: (value: T) => boolean | string;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FieldValidation {
  value: any;
  errors: string[];
  isValid: boolean;
  isDirty: boolean;
}

export const useValidation = <T extends Record<string, any>>(
  initialValues: T,
  rules: Partial<Record<keyof T, ValidationRule[]>> = {}
) => {
  const [values, setValues] = useState<T>(initialValues);
  const [fieldStates, setFieldStates] = useState<Record<keyof T, FieldValidation>>(
    Object.keys(initialValues).reduce((acc, key) => ({
      ...acc,
      [key]: {
        value: initialValues[key as keyof T],
        errors: [],
        isValid: true,
        isDirty: false,
      }
    }), {} as Record<keyof T, FieldValidation>)
  );

  const validateField = useCallback((
    fieldName: keyof T,
    value: any,
    fieldRules: ValidationRule[] = []
  ): ValidationResult => {
    const errors: string[] = [];

    for (const rule of fieldRules) {
      const result = rule.validate(value);
      if (result !== true) {
        errors.push(typeof result === 'string' ? result : rule.message || 'Invalid value');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  const validateAllFields = useCallback((): ValidationResult => {
    const allErrors: string[] = [];
    let isValid = true;

    Object.keys(values).forEach(key => {
      const fieldName = key as keyof T;
      const fieldRules = rules[fieldName] || [];
      const result = validateField(fieldName, values[fieldName], fieldRules);
      
      if (!result.isValid) {
        isValid = false;
        allErrors.push(...result.errors);
      }
    });

    return { isValid, errors: allErrors };
  }, [values, rules, validateField]);

  const setValue = useCallback((fieldName: keyof T, value: any) => {
    const fieldRules = rules[fieldName] || [];
    const validation = validateField(fieldName, value, fieldRules);

    setValues(prev => ({ ...prev, [fieldName]: value }));
    setFieldStates(prev => ({
      ...prev,
      [fieldName]: {
        value,
        errors: validation.errors,
        isValid: validation.isValid,
        isDirty: true,
      }
    }));
  }, [rules, validateField]);

  const setMultipleValues = useCallback((newValues: Partial<T>) => {
    Object.entries(newValues).forEach(([key, value]) => {
      setValue(key as keyof T, value);
    });
  }, [setValue]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setFieldStates(
      Object.keys(initialValues).reduce((acc, key) => ({
        ...acc,
        [key]: {
          value: initialValues[key as keyof T],
          errors: [],
          isValid: true,
          isDirty: false,
        }
      }), {} as Record<keyof T, FieldValidation>)
    );
  }, [initialValues]);

  const getFieldError = useCallback((fieldName: keyof T): string | undefined => {
    return fieldStates[fieldName]?.errors[0];
  }, [fieldStates]);

  const isFieldValid = useCallback((fieldName: keyof T): boolean => {
    return fieldStates[fieldName]?.isValid ?? true;
  }, [fieldStates]);

  const isFieldDirty = useCallback((fieldName: keyof T): boolean => {
    return fieldStates[fieldName]?.isDirty ?? false;
  }, [fieldStates]);

  return {
    values,
    setValue,
    setValues: setMultipleValues,
    validateField,
    validateAllFields,
    reset,
    getFieldError,
    isFieldValid,
    isFieldDirty,
    fieldStates,
  };
};

// Common validation rules
export const validationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    validate: (value) => {
      if (value === null || value === undefined || value === '') {
        return message;
      }
      return true;
    },
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value: string) => {
      if (typeof value === 'string' && value.length < min) {
        return message || `Must be at least ${min} characters`;
      }
      return true;
    },
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value: string) => {
      if (typeof value === 'string' && value.length > max) {
        return message || `Must be no more than ${max} characters`;
      }
      return true;
    },
  }),

  range: (min: number, max: number, message?: string): ValidationRule => ({
    validate: (value: number) => {
      if (typeof value === 'number' && (value < min || value > max)) {
        return message || `Must be between ${min} and ${max}`;
      }
      return true;
    },
  }),

  fileSize: (maxSizeBytes: number, message?: string): ValidationRule => ({
    validate: (file: File) => {
      if (file && file.size > maxSizeBytes) {
        const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024));
        return message || `File size must be less than ${maxSizeMB}MB`;
      }
      return true;
    },
  }),

  audioFormat: (allowedFormats: string[], message?: string): ValidationRule => ({
    validate: (file: File) => {
      if (file) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!extension || !allowedFormats.includes(extension)) {
          return message || `Only ${allowedFormats.join(', ')} files are allowed`;
        }
      }
      return true;
    },
  }),

  lufsRange: (message = 'LUFS value must be between -70 and 0'): ValidationRule => ({
    validate: (value: number) => {
      if (typeof value === 'number' && (value < -70 || value > 0)) {
        return message;
      }
      return true;
    },
  }),

  dbRange: (min = -60, max = 0, message?: string): ValidationRule => ({
    validate: (value: number) => {
      if (typeof value === 'number' && (value < min || value > max)) {
        return message || `dB value must be between ${min} and ${max}`;
      }
      return true;
    },
  }),
};