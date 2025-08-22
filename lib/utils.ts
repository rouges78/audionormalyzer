import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format duration in MM:SS format
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Format audio level in dB
 */
export function formatAudioLevel(level: number): string {
  return `${level.toFixed(1)} dB`
}

/**
 * Format LUFS value
 */
export function formatLUFS(lufs: number): string {
  return `${lufs.toFixed(1)} LUFS`
}

/**
 * Get audio level color based on value
 */
export function getAudioLevelColor(level: number, type: 'peak' | 'lufs' = 'peak'): string {
  if (type === 'peak') {
    if (level >= -1) return 'danger'
    if (level >= -6) return 'warning'
    return 'safe'
  } else {
    // LUFS levels
    if (level >= -6) return 'danger'
    if (level >= -12) return 'warning'
    return 'safe'
  }
}

/**
 * Validate audio file extension
 */
export function isValidAudioFile(filename: string): boolean {
  const validExtensions = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg']
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return validExtensions.includes(extension)
}

/**
 * Get audio format from filename
 */
export function getAudioFormat(filename: string): string {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  
  switch (extension) {
    case '.mp3': return 'MP3'
    case '.wav': return 'WAV'
    case '.flac': return 'FLAC'
    case '.aac': return 'AAC'
    case '.m4a': return 'M4A/AAC'
    case '.ogg': return 'OGG Vorbis'
    default: return 'Unknown'
  }
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0
  return Math.min(Math.max((current / total) * 100, 0), 100)
}

/**
 * Format processing time
 */
export function formatProcessingTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Validate LUFS target level
 */
export function isValidLUFSTarget(lufs: number): boolean {
  return lufs >= -50 && lufs <= -6
}

/**
 * Validate peak target level
 */
export function isValidPeakTarget(peak: number): boolean {
  return peak >= -60 && peak <= 0
}

/**
 * Get normalization method display name
 */
export function getNormalizationMethodName(method: string): string {
  switch (method) {
    case 'peak': return 'Peak Normalization'
    case 'loudness': return 'Loudness Normalization'
    default: return 'Unknown Method'
  }
}

/**
 * Get file status color
 */
export function getFileStatusColor(status: string): string {
  switch (status) {
    case 'ready': return 'text-blue-600'
    case 'processing': return 'text-yellow-600'
    case 'completed': return 'text-green-600'
    case 'error': return 'text-red-600'
    default: return 'text-gray-600'
  }
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry utility for failed operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (attempt === maxAttempts) {
        throw lastError
      }
      
      await sleep(delay * attempt) // Exponential backoff
    }
  }
  
  throw lastError!
}