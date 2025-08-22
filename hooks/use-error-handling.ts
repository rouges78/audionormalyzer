'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface ErrorState {
  message: string;
  type: 'network' | 'validation' | 'processing' | 'upload' | 'download' | 'unknown';
  code?: string;
  retryable: boolean;
  timestamp: Date;
}

export interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  backoffMultiplier?: number;
}

export const useErrorHandling = () => {
  const [errors, setErrors] = useState<ErrorState[]>([]);
  const [retryCount, setRetryCount] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const classifyError = useCallback((error: Error | string): ErrorState['type'] => {
    const message = typeof error === 'string' ? error : error.message;
    
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    if (message.includes('processing') || message.includes('audio')) return 'processing';
    if (message.includes('upload')) return 'upload';
    if (message.includes('download')) return 'download';
    
    return 'unknown';
  }, []);

  const isRetryable = useCallback((type: ErrorState['type']): boolean => {
    return ['network', 'processing', 'upload', 'download'].includes(type);
  }, []);

  const handleError = useCallback((
    error: Error | string,
    options?: { 
      showToast?: boolean;
      code?: string;
      context?: string;
    }
  ) => {
    const message = typeof error === 'string' ? error : error.message;
    const type = classifyError(error);
    
    const errorState: ErrorState = {
      message,
      type,
      code: options?.code,
      retryable: isRetryable(type),
      timestamp: new Date(),
    };

    setErrors(prev => [...prev, errorState]);

    if (options?.showToast !== false) {
      const contextMessage = options?.context ? `${options.context}: ` : '';
      
      toast({
        title: getErrorTitle(type),
        description: `${contextMessage}${message}`,
        variant: 'destructive',
      });
    }

    // Log error for debugging
    console.error(`[${type.toUpperCase()}] ${message}`, error);

    return errorState;
  }, [classifyError, isRetryable, toast]);

  const retryOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    operationId: string,
    options: RetryOptions = {}
  ): Promise<T> => {
    const {
      maxRetries = 3,
      delay = 1000,
      backoffMultiplier = 2
    } = options;

    const currentRetries = retryCount[operationId] || 0;

    try {
      const result = await operation();
      
      // Reset retry count on success
      if (currentRetries > 0) {
        setRetryCount(prev => ({ ...prev, [operationId]: 0 }));
      }
      
      return result;
    } catch (error) {
      const errorState = handleError(error as Error, { showToast: false });
      
      if (errorState.retryable && currentRetries < maxRetries) {
        const nextRetryCount = currentRetries + 1;
        setRetryCount(prev => ({ ...prev, [operationId]: nextRetryCount }));
        
        // Show retry toast
        toast({
          title: 'Retrying operation',
          description: `Attempt ${nextRetryCount} of ${maxRetries}`,
        });

        // Wait with exponential backoff
        const waitTime = delay * Math.pow(backoffMultiplier, currentRetries);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        return retryOperation(operation, operationId, options);
      }
      
      // Show final error toast
      toast({
        title: getErrorTitle(errorState.type),
        description: `${errorState.message}${currentRetries > 0 ? ` (after ${currentRetries} retries)` : ''}`,
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [retryCount, handleError, toast]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const clearError = useCallback((index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  }, []);

  const getLastError = useCallback((type?: ErrorState['type']) => {
    if (type) {
      return errors.filter(error => error.type === type).pop();
    }
    return errors[errors.length - 1];
  }, [errors]);

  return {
    errors,
    handleError,
    retryOperation,
    clearErrors,
    clearError,
    getLastError,
    retryCount,
  };
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