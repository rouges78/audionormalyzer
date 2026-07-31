/**
 * In-memory storage for analysis results
 * In production, this should be replaced with a proper database
 */

import { scheduleBackgroundCleanup } from './background-cleanup'

export interface AnalysisResult {
  fileId: string
  fileName: string
  success: boolean
  analysis?: {
    duration: number
    sampleRate: number
    channels: number
    peakLevel: number
    rmsLevel: number
    lufsIntegrated: number
    truePeak: number
    hasClipping: boolean
    format?: string
  }
  error?: string
  processingTime?: number
}

export interface AnalysisData {
  id: string
  status: 'processing' | 'completed' | 'error'
  totalFiles: number
  processedFiles: number
  results: AnalysisResult[]
  startTime: number
  endTime?: number
  processingTime?: number
  error?: string
}

class AnalysisStorageClass {
  private storage = new Map<string, AnalysisData>()

  create(id: string, totalFiles: number): AnalysisData {
    const data: AnalysisData = {
      id,
      status: 'processing',
      totalFiles,
      processedFiles: 0,
      results: [],
      startTime: Date.now()
    }
    
    this.storage.set(id, data)
    return data
  }

  get(id: string): AnalysisData | null {
    return this.storage.get(id) || null
  }

  update(id: string, updates: Partial<AnalysisData>): AnalysisData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    const updated = { ...existing, ...updates }
    this.storage.set(id, updated)
    return updated
  }

  addResult(id: string, result: AnalysisResult): AnalysisData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    existing.results.push(result)
    existing.processedFiles = existing.results.length

    // Check if all files are processed
    if (existing.processedFiles >= existing.totalFiles) {
      existing.status = 'completed'
      existing.endTime = Date.now()
      existing.processingTime = existing.endTime - existing.startTime
    }

    this.storage.set(id, existing)
    return existing
  }

  setError(id: string, error: string): AnalysisData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    existing.status = 'error'
    existing.error = error
    existing.endTime = Date.now()
    existing.processingTime = existing.endTime - existing.startTime

    this.storage.set(id, existing)
    return existing
  }

  delete(id: string): boolean {
    return this.storage.delete(id)
  }

  clear(): void {
    this.storage.clear()
  }

  // Cleanup old entries (older than 24 hours)
  cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    
    for (const [id, data] of this.storage.entries()) {
      if (data.startTime < cutoff) {
        this.storage.delete(id)
      }
    }
  }

  // Get all active analyses
  getActive(): AnalysisData[] {
    return Array.from(this.storage.values()).filter(data => data.status === 'processing')
  }

  // Get statistics
  getStats(): {
    total: number
    processing: number
    completed: number
    error: number
  } {
    const all = Array.from(this.storage.values())
    
    return {
      total: all.length,
      processing: all.filter(d => d.status === 'processing').length,
      completed: all.filter(d => d.status === 'completed').length,
      error: all.filter(d => d.status === 'error').length
    }
  }
}

export const AnalysisStorage = new AnalysisStorageClass()

// Pulizia automatica ogni ora (non registrata in test, non blocca l'uscita).
scheduleBackgroundCleanup(() => AnalysisStorage.cleanup(), 60 * 60 * 1000)