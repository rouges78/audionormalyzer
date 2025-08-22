'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, X, Info, AlertCircle, Wifi, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/hooks/use-error-handling';

interface ErrorDisplayProps {
  errors: ErrorState[];
  onRetry?: (error: ErrorState) => void;
  onDismiss?: (index: number) => void;
  onClearAll?: () => void;
  className?: string;
}

const getErrorIcon = (type: ErrorState['type']) => {
  switch (type) {
    case 'network':
      return <Wifi className="h-4 w-4" />;
    case 'upload':
      return <Upload className="h-4 w-4" />;
    case 'download':
      return <Download className="h-4 w-4" />;
    case 'processing':
      return <AlertCircle className="h-4 w-4" />;
    case 'validation':
      return <Info className="h-4 w-4" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
};

const getErrorVariant = (type: ErrorState['type']): 'default' | 'destructive' => {
  switch (type) {
    case 'validation':
      return 'default';
    default:
      return 'destructive';
  }
};

const getErrorTitle = (type: ErrorState['type']): string => {
  switch (type) {
    case 'network':
      return 'Connection Error';
    case 'validation':
      return 'Validation Error';
    case 'processing':
      return 'Processing Error';
    case 'upload':
      return 'Upload Error';
    case 'download':
      return 'Download Error';
    default:
      return 'Error';
  }
};

const getErrorSuggestion = (type: ErrorState['type']): string => {
  switch (type) {
    case 'network':
      return 'Check your internet connection and try again.';
    case 'validation':
      return 'Please check your input and correct any issues.';
    case 'processing':
      return 'Try with a different file or check if the file is corrupted.';
    case 'upload':
      return 'Make sure your file is a supported audio format and under the size limit.';
    case 'download':
      return 'Try downloading again or check your browser settings.';
    default:
      return 'Please try again or contact support if the problem persists.';
  }
};

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  errors,
  onRetry,
  onDismiss,
  onClearAll,
  className = ''
}) => {
  if (errors.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {errors.length > 1 && onClearAll && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {errors.length} errors occurred
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-red-600 hover:text-red-700"
          >
            Clear All
          </Button>
        </div>
      )}

      {errors.map((error, index) => (
        <Alert key={index} variant={getErrorVariant(error.type)} className="relative">
          {getErrorIcon(error.type)}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <AlertTitle className="flex items-center gap-2">
                {getErrorTitle(error.type)}
                <Badge variant="outline" className="text-xs">
                  {error.type}
                </Badge>
                {error.code && (
                  <Badge variant="secondary" className="text-xs">
                    {error.code}
                  </Badge>
                )}
              </AlertTitle>
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDismiss(index)}
                  className="h-6 w-6 p-0 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <AlertDescription className="mt-2">
              <div className="space-y-2">
                <p>{error.message}</p>
                <p className="text-xs opacity-75">
                  {getErrorSuggestion(error.type)}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-60">
                    {error.timestamp.toLocaleTimeString()}
                  </span>
                  {error.retryable && onRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry(error)}
                      className="h-7 text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            </AlertDescription>
          </div>
        </Alert>
      ))}
    </div>
  );
};

// Specialized error displays for different contexts
export const UploadErrorDisplay: React.FC<{
  errors: ErrorState[];
  onRetry?: () => void;
  onClearAll?: () => void;
}> = ({ errors, onRetry, onClearAll }) => {
  const uploadErrors = errors.filter(e => ['upload', 'validation'].includes(e.type));
  
  if (uploadErrors.length === 0) return null;

  return (
    <ErrorDisplay
      errors={uploadErrors}
      onRetry={onRetry ? () => onRetry() : undefined}
      onClearAll={onClearAll}
      className="mb-4"
    />
  );
};

export const ProcessingErrorDisplay: React.FC<{
  errors: ErrorState[];
  onRetry?: () => void;
  onClearAll?: () => void;
}> = ({ errors, onRetry, onClearAll }) => {
  const processingErrors = errors.filter(e => ['processing', 'network'].includes(e.type));
  
  if (processingErrors.length === 0) return null;

  return (
    <ErrorDisplay
      errors={processingErrors}
      onRetry={onRetry ? () => onRetry() : undefined}
      onClearAll={onClearAll}
      className="mb-4"
    />
  );
};