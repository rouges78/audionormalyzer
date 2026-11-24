/**
 * In-memory storage for processing results
 * In production, this should be replaced with a proper database
 */

import { scheduleBackgroundCleanup } from './background-cleanup'

export interface ProcessingResult {
  fileId: string
  fileName: string
  success: boolean
  originalPath?: string
  outputPath?: string
  originalLoudness?: number
  finalLoudness?: number
  gainApplied?: number
  processingTime?: number
  error?: string
}

/**
 * Summary statistics exposed by the GET /api/process/[id] route
 * when processing has finished.
 */
export interface ProcessingSummary {
  totalSuccessful: number
  totalFailed: number
  averageGainApplied: number
  averageProcessingTime: number
  totalOutputSize: number
  outputFiles: string[]
}

export interface ProcessingData {
  id: string
  status: 'processing' | 'completed' | 'error'
  method: 'peak' | 'loudness'
  targetLevel: number
  totalFiles: number
  processedFiles: number
  successfulFiles: number
  failedFiles: number
  results: ProcessingResult[]
  /** Timestamp in milliseconds (Date.now()), not a Date object. */
  startTime: number
  /** Timestamp in milliseconds (Date.now()), not a Date object. */
  endTime?: number
  processingTime?: number
  error?: string
  outputDirectory?: string
  /** Album mode: the tracks are normalized as a single whole. */
  albumMode?: boolean
  /** In album mode, keeps the dynamic differences between tracks. */
  maintainRelativeLoudness?: boolean
  /** 'preserve' or a specific output format. */
  outputFormat?: string
}

class ProcessingStorageClass {
  private storage = new Map<string, ProcessingData>()

  create(
    id: string, 
    method: 'peak' | 'loudness', 
    targetLevel: number, 
    totalFiles: number
  ): ProcessingData {
    const data: ProcessingData = {
      id,
      status: 'processing',
      method,
      targetLevel,
      totalFiles,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      results: [],
      startTime: Date.now()
    }
    
    this.storage.set(id, data)
    return data
  }

  get(id: string): ProcessingData | null {
    return this.storage.get(id) || null
  }

  /**
   * Writes (or overwrites) the whole record of a processing job.
   * The API routes mutate the object obtained from get() and save it again here:
   * unlike update(), which merges a Partial, set() replaces everything.
   */
  set(id: string, data: ProcessingData): ProcessingData {
    this.storage.set(id, data)
    return data
  }

  update(id: string, updates: Partial<ProcessingData>): ProcessingData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    const updated = { ...existing, ...updates }
    this.storage.set(id, updated)
    return updated
  }

  addResult(id: string, result: ProcessingResult): ProcessingData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    existing.results.push(result)
    existing.processedFiles = existing.results.length
    
    if (result.success) {
      existing.successfulFiles++
    } else {
      existing.failedFiles++
    }

    // Check if all files are processed
    if (existing.processedFiles >= existing.totalFiles) {
      existing.status = 'completed'
      existing.endTime = Date.now()
      existing.processingTime = existing.endTime - existing.startTime
    }

    this.storage.set(id, existing)
    return existing
  }

  setError(id: string, error: string): ProcessingData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    existing.status = 'error'
    existing.error = error
    existing.endTime = Date.now()
    existing.processingTime = existing.endTime - existing.startTime

    this.storage.set(id, existing)
    return existing
  }

  setOutputDirectory(id: string, outputDirectory: string): ProcessingData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    existing.outputDirectory = outputDirectory
    this.storage.set(id, existing)
    return existing
  }

  /** Is there a record with this id? */
  has(id: string): boolean {
    return this.storage.has(id)
  }

  /** Number of processing jobs currently in memory. */
  size(): number {
    return this.storage.size
  }

  delete(id: string): boolean {
    return this.storage.delete(id)
  }

  clear(): void {
    this.storage.clear()
  }

  // Cleanup old entries (older than 24 hours)
  /**
   * Removes processing jobs older than the retention window.
   * @returns Number of records removed (it used to return nothing, so the
   * caller could neither log nor verify the effect of the cleanup).
   */
  cleanup(): number {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    let removed = 0

    for (const [id, data] of this.storage.entries()) {
      if (Number(data.startTime) < cutoff) {
        this.storage.delete(id)
        removed++
      }
    }

    return removed
  }

  // Get all active processing jobs
  getActive(): ProcessingData[] {
    return Array.from(this.storage.values()).filter(data => data.status === 'processing')
  }

  // Get statistics
  getStats(): {
    total: number
    processing: number
    completed: number
    error: number
    totalFilesProcessed: number
    totalSuccessful: number
    totalFailed: number
    /** Start time of the oldest processing job still in memory. */
    oldestProcessing: number | null
  } {
    const all = Array.from(this.storage.values())
    const startTimes = all.map(d => Number(d.startTime)).filter(t => !Number.isNaN(t))

    return {
      total: all.length,
      processing: all.filter(d => d.status === 'processing').length,
      completed: all.filter(d => d.status === 'completed').length,
      error: all.filter(d => d.status === 'error').length,
      totalFilesProcessed: all.reduce((sum, d) => sum + d.processedFiles, 0),
      totalSuccessful: all.reduce((sum, d) => sum + (d.successfulFiles ?? 0), 0),
      totalFailed: all.reduce((sum, d) => sum + (d.failedFiles ?? 0), 0),
      oldestProcessing: startTimes.length > 0 ? Math.min(...startTimes) : null
    }
  }

  // Get processing history for a specific method
  getByMethod(method: 'peak' | 'loudness'): ProcessingData[] {
    return Array.from(this.storage.values()).filter(data => data.method === method)
  }

  // Get recent completed jobs
  getRecentCompleted(limit: number = 10): ProcessingData[] {
    return Array.from(this.storage.values())
      .filter(data => data.status === 'completed')
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
      .slice(0, limit)
  }
}

export const ProcessingStorage = new ProcessingStorageClass()

// Automatic cleanup every hour (not registered in tests, does not block exit).
scheduleBackgroundCleanup(() => { ProcessingStorage.cleanup() }, 60 * 60 * 1000)