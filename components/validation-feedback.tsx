'use client';

import React from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface ValidationFeedbackProps {
  error?: string;
  isValid?: boolean;
  isDirty?: boolean;
  showSuccess?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  error,
  isValid = true,
  isDirty = false,
  showSuccess = false,
  className = '',
  children
}) => {
  // Don't show anything if field hasn't been touched
  if (!isDirty && !error) return null;

  // Show error if there is one
  if (error) {
    return (
      <div className={cn('mt-1', className)}>
        <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
        {children}
      </div>
    );
  }

  // Show success if valid and we want to show success
  if (isValid && isDirty && showSuccess) {
    return (
      <div className={cn('mt-1', className)}>
        <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-3 w-3 flex-shrink-0" />
          <span>Valid</span>
        </div>
        {children}
      </div>
    );
  }

  return children ? <div className={cn('mt-1', className)}>{children}</div> : null;
};

interface FieldValidationProps {
  label: string;
  error?: string;
  isValid?: boolean;
  isDirty?: boolean;
  required?: boolean;
  helpText?: string;
  className?: string;
  children: React.ReactNode;
}

export const FieldValidation: React.FC<FieldValidationProps> = ({
  label,
  error,
  isValid = true,
  isDirty = false,
  required = false,
  helpText,
  className = '',
  children
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className={cn(
        'relative',
        error && 'ring-1 ring-red-500 rounded-md'
      )}>
        {children}
      </div>
      
      <ValidationFeedback
        error={error}
        isValid={isValid}
        isDirty={isDirty}
        showSuccess={true}
      >
        {helpText && !error && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Info className="h-3 w-3 flex-shrink-0" />
            <span>{helpText}</span>
          </div>
        )}
      </ValidationFeedback>
    </div>
  );
};

interface FormValidationSummaryProps {
  errors: string[];
  className?: string;
}

export const FormValidationSummary: React.FC<FormValidationSummaryProps> = ({
  errors,
  className = ''
}) => {
  if (errors.length === 0) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-1">
          <p className="font-medium">Please correct the following errors:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  );
};

// File-specific validation components
interface FileValidationProps {
  file: File;
  maxSize?: number;
  allowedFormats?: string[];
  className?: string;
}

export const FileValidation: React.FC<FileValidationProps> = ({
  file,
  maxSize = 100 * 1024 * 1024, // 100MB default
  allowedFormats = ['mp3', 'wav', 'flac', 'aac', 'm4a'],
  className = ''
}) => {
  const errors: string[] = [];
  
  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    errors.push(`File size (${Math.round(file.size / (1024 * 1024))}MB) exceeds limit of ${maxSizeMB}MB`);
  }
  
  // Check file format
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !allowedFormats.includes(extension)) {
    errors.push(`File format .${extension} is not supported. Allowed formats: ${allowedFormats.join(', ')}`);
  }
  
  if (errors.length === 0) {
    return (
      <div className={cn('flex items-center gap-1 text-xs text-green-600 dark:text-green-400', className)}>
        <CheckCircle className="h-3 w-3" />
        <span>Valid audio file</span>
      </div>
    );
  }
  
  return (
    <div className={cn('space-y-1', className)}>
      {errors.map((error, index) => (
        <div key={index} className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ))}
    </div>
  );
};

interface AudioParameterValidationProps {
  value: number;
  min: number;
  max: number;
  unit: string;
  label: string;
  className?: string;
}

export const AudioParameterValidation: React.FC<AudioParameterValidationProps> = ({
  value,
  min,
  max,
  unit,
  label,
  className = ''
}) => {
  const isValid = value >= min && value <= max;
  
  return (
    <div className={cn('text-xs', className)}>
      {isValid ? (
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle className="h-3 w-3" />
          <span>{label}: {value}{unit} (valid range: {min} to {max}{unit})</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <AlertCircle className="h-3 w-3" />
          <span>{label}: {value}{unit} is outside valid range ({min} to {max}{unit})</span>
        </div>
      )}
    </div>
  );
};