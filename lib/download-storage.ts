/**
 * In-memory storage for download management
 * In production, this should be replaced with a proper database
 */

export interface DownloadFile {
  id: string
  originalName: string
  processedPath: string
  size: number
  format: string
}

export interface DownloadData {
  id: string
  type: 'individual' | 'batch'
  status: 'preparing' | 'ready' | 'downloading' | 'completed' | 'error'
  processId: string
  files: DownloadFile[]
  totalSize: number
  downloadPath?: string
  zipPath?: string
  createdAt: number
  expiresAt: number
  downloadCount: number
  maxDownloads: number
  error?: string
}

class DownloadStorageClass {
  private storage = new Map<string, DownloadData>()

  create(
    id: string,
    type: 'individual' | 'batch',
    processId: string,
    files: DownloadFile[],
    maxDownloads: number = 5
  ): DownloadData {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    
    const data: DownloadData = {
      id,
      type,
      status: 'preparing',
      processId,
      files,
      totalSize,
      createdAt: Date.now(),
      expiresAt,
      downloadCount: 0,
      maxDownloads
    }
    
    this.storage.set(id, data)
    return data
  }

  get(id: string): DownloadData | null {
    const data = this.storage.get(id)
    
    // Check if expired
    if (data && Date.now() > data.expiresAt) {
      this.storage.delete(id)
      return null
    }
    
    return data || null
  }

  update(id: string, updates: Partial<DownloadData>): DownloadData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    const updated = { ...existing, ...updates }
    this.storage.set(id, updated)
    return updated
  }

  setReady(id: string, downloadPath: string, zipPath?: string): DownloadData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    existing.status = 'ready'
    existing.downloadPath = downloadPath
    if (zipPath) {
      existing.zipPath = zipPath
    }

    this.storage.set(id, existing)
    return existing
  }

  incrementDownloadCount(id: string): DownloadData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    existing.downloadCount++
    existing.status = 'downloading'

    // Check if max downloads reached
    if (existing.downloadCount >= existing.maxDownloads) {
      existing.status = 'completed'
    }

    this.storage.set(id, existing)
    return existing
  }

  setError(id: string, error: string): DownloadData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    existing.status = 'error'
    existing.error = error

    this.storage.set(id, existing)
    return existing
  }

  delete(id: string): boolean {
    return this.storage.delete(id)
  }

  clear(): void {
    this.storage.clear()
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now()
    
    for (const [id, data] of this.storage.entries()) {
      if (now > data.expiresAt) {
        this.storage.delete(id)
      }
    }
  }

  // Get all active downloads
  getActive(): DownloadData[] {
    return Array.from(this.storage.values()).filter(data => 
      data.status === 'preparing' || data.status === 'ready' || data.status === 'downloading'
    )
  }

  // Get downloads by process ID
  getByProcessId(processId: string): DownloadData[] {
    return Array.from(this.storage.values()).filter(data => data.processId === processId)
  }

  // Get statistics
  getStats(): {
    total: number
    preparing: number
    ready: number
    downloading: number
    completed: number
    error: number
    totalSize: number
    totalDownloads: number
  } {
    const all = Array.from(this.storage.values())
    
    return {
      total: all.length,
      preparing: all.filter(d => d.status === 'preparing').length,
      ready: all.filter(d => d.status === 'ready').length,
      downloading: all.filter(d => d.status === 'downloading').length,
      completed: all.filter(d => d.status === 'completed').length,
      error: all.filter(d => d.status === 'error').length,
      totalSize: all.reduce((sum, d) => sum + d.totalSize, 0),
      totalDownloads: all.reduce((sum, d) => sum + d.downloadCount, 0)
    }
  }

  // Check if download is available
  isAvailable(id: string): boolean {
    const data = this.get(id)
    return data !== null && 
           data.status === 'ready' && 
           data.downloadCount < data.maxDownloads &&
           Date.now() <= data.expiresAt
  }

  // Get remaining downloads
  getRemainingDownloads(id: string): number {
    const data = this.get(id)
    if (!data) return 0
    
    return Math.max(0, data.maxDownloads - data.downloadCount)
  }

  // Get time until expiry
  getTimeUntilExpiry(id: string): number {
    const data = this.get(id)
    if (!data) return 0
    
    return Math.max(0, data.expiresAt - Date.now())
  }

  // Extend expiry time
  extendExpiry(id: string, additionalHours: number = 24): DownloadData | null {
    const existing = this.storage.get(id)
    if (!existing) return null

    existing.expiresAt = Math.max(existing.expiresAt, Date.now()) + (additionalHours * 60 * 60 * 1000)
    this.storage.set(id, existing)
    return existing
  }
}

export const DownloadStorage = new DownloadStorageClass()

// Auto-cleanup every hour
if (typeof window === 'undefined') { // Server-side only
  setInterval(() => {
    DownloadStorage.cleanup()
  }, 60 * 60 * 1000) // 1 hour
}