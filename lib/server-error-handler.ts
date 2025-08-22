import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export interface ServerError extends Error {
  statusCode?: number;
  code?: string;
  context?: Record<string, any>;
  retryable?: boolean;
}

export interface ErrorLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    statusCode?: number;
    code?: string;
  };
  context?: Record<string, any>;
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
}

class ServerErrorHandler {
  private logDir: string;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private maxLogFiles: number = 5;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory() {
    try {
      await fs.access(this.logDir);
    } catch {
      await fs.mkdir(this.logDir, { recursive: true });
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async writeLog(entry: ErrorLogEntry) {
    const logFile = path.join(this.logDir, `audio-normalizer-${new Date().toISOString().split('T')[0]}.log`);
    const logLine = JSON.stringify(entry) + '\n';

    try {
      await fs.appendFile(logFile, logLine);
      await this.rotateLogsIfNeeded(logFile);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  private async rotateLogsIfNeeded(logFile: string) {
    try {
      const stats = await fs.stat(logFile);
      if (stats.size > this.maxLogSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = logFile.replace('.log', `-${timestamp}.log`);
        await fs.rename(logFile, rotatedFile);
        
        // Clean up old log files
        await this.cleanupOldLogs();
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  private async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter(file => file.startsWith('audio-normalizer-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          stat: null as any
        }));

      // Get file stats
      for (const file of logFiles) {
        try {
          file.stat = await fs.stat(file.path);
        } catch {
          // Ignore files that can't be accessed
        }
      }

      // Sort by modification time (newest first)
      const sortedFiles = logFiles
        .filter(file => file.stat)
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      // Remove excess files
      if (sortedFiles.length > this.maxLogFiles) {
        const filesToDelete = sortedFiles.slice(this.maxLogFiles);
        for (const file of filesToDelete) {
          try {
            await fs.unlink(file.path);
          } catch (error) {
            console.error(`Failed to delete log file ${file.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  public createError(
    message: string,
    statusCode: number = 500,
    code?: string,
    context?: Record<string, any>,
    retryable: boolean = false
  ): ServerError {
    const error = new Error(message) as ServerError;
    error.statusCode = statusCode;
    error.code = code;
    error.context = context;
    error.retryable = retryable;
    return error;
  }

  public async logError(
    error: Error | ServerError,
    context?: Record<string, any>,
    requestId?: string,
    endpoint?: string,
    method?: string
  ) {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        statusCode: (error as ServerError).statusCode,
        code: (error as ServerError).code,
      },
      context: {
        ...(error as ServerError).context,
        ...context,
      },
      requestId,
      endpoint,
      method,
    };

    await this.writeLog(entry);
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${entry.timestamp}] ${entry.message}`, {
        error: entry.error,
        context: entry.context,
      });
    }
  }

  public async logInfo(
    message: string,
    context?: Record<string, any>,
    requestId?: string
  ) {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
      requestId,
    };

    await this.writeLog(entry);
  }

  public async logWarning(
    message: string,
    context?: Record<string, any>,
    requestId?: string
  ) {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
      requestId,
    };

    await this.writeLog(entry);
  }

  public handleApiError(
    error: Error | ServerError,
    request?: NextRequest,
    context?: Record<string, any>
  ): NextResponse {
    const requestId = this.generateRequestId();
    const endpoint = request?.nextUrl?.pathname;
    const method = request?.method;

    // Log the error
    this.logError(error, context, requestId, endpoint, method);

    // Determine response based on error type
    const serverError = error as ServerError;
    const statusCode = serverError.statusCode || 500;
    const code = serverError.code || 'INTERNAL_ERROR';

    // Don't expose internal error details in production
    const message = process.env.NODE_ENV === 'production' 
      ? this.getPublicErrorMessage(statusCode, code)
      : error.message;

    return NextResponse.json(
      {
        success: false,
        error: {
          message,
          code,
          requestId,
          retryable: serverError.retryable || false,
          timestamp: new Date().toISOString(),
        },
      },
      { status: statusCode }
    );
  }

  private getPublicErrorMessage(statusCode: number, code: string): string {
    switch (statusCode) {
      case 400:
        return 'Bad request. Please check your input.';
      case 401:
        return 'Authentication required.';
      case 403:
        return 'Access denied.';
      case 404:
        return 'Resource not found.';
      case 413:
        return 'File too large.';
      case 415:
        return 'Unsupported file format.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Internal server error. Please try again.';
      case 503:
        return 'Service temporarily unavailable.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  public async cleanupTempFiles(tempPaths: string[]) {
    for (const tempPath of tempPaths) {
      try {
        await fs.unlink(tempPath);
        await this.logInfo(`Cleaned up temp file: ${tempPath}`);
      } catch (error) {
        await this.logWarning(`Failed to cleanup temp file: ${tempPath}`, {
          error: (error as Error).message,
        });
      }
    }
  }

  public async cleanupProcessingFiles(processingId: string) {
    try {
      const tempDir = path.join(process.cwd(), 'temp', 'audio');
      const files = await fs.readdir(tempDir);
      
      const filesToClean = files.filter(file => file.includes(processingId));
      
      for (const file of filesToClean) {
        const filePath = path.join(tempDir, file);
        try {
          await fs.unlink(filePath);
        } catch (error) {
          await this.logWarning(`Failed to cleanup processing file: ${filePath}`, {
            error: (error as Error).message,
          });
        }
      }
      
      await this.logInfo(`Cleaned up ${filesToClean.length} processing files for ID: ${processingId}`);
    } catch (error) {
      await this.logError(error as Error, { processingId }, undefined, 'cleanup');
    }
  }
}

// Singleton instance
export const serverErrorHandler = new ServerErrorHandler();

// Utility function for wrapping API handlers
export function withErrorHandling(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return serverErrorHandler.handleApiError(error as Error, request);
    }
  };
}

// Common error types
export const ErrorTypes = {
  VALIDATION_ERROR: (message: string, context?: Record<string, any>) =>
    serverErrorHandler.createError(message, 400, 'VALIDATION_ERROR', context),
  
  FILE_NOT_FOUND: (filePath: string) =>
    serverErrorHandler.createError(`File not found: ${filePath}`, 404, 'FILE_NOT_FOUND', { filePath }),
  
  UNSUPPORTED_FORMAT: (format: string) =>
    serverErrorHandler.createError(`Unsupported format: ${format}`, 415, 'UNSUPPORTED_FORMAT', { format }),
  
  FILE_TOO_LARGE: (size: number, maxSize: number) =>
    serverErrorHandler.createError(
      `File size ${size} exceeds maximum ${maxSize}`,
      413,
      'FILE_TOO_LARGE',
      { size, maxSize }
    ),
  
  PROCESSING_ERROR: (message: string, context?: Record<string, any>) =>
    serverErrorHandler.createError(message, 500, 'PROCESSING_ERROR', context, true),
  
  NETWORK_ERROR: (message: string) =>
    serverErrorHandler.createError(message, 503, 'NETWORK_ERROR', undefined, true),
  
  TIMEOUT_ERROR: (operation: string, timeout: number) =>
    serverErrorHandler.createError(
      `Operation ${operation} timed out after ${timeout}ms`,
      408,
      'TIMEOUT_ERROR',
      { operation, timeout },
      true
    ),
};