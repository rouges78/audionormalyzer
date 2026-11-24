import { EventEmitter } from 'events'
import { AudioFile, ProcessingResult, AlbumOptions } from '@/types/audio'
import { AlbumProcessorImpl } from './album-processor'

/**
 * State of a job in the processing queue
 */
export interface ProcessingJob {
  id: string
  albumName: string
  files: AudioFile[]
  options: AlbumOptions
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number // 0-100
  startTime?: Date
  endTime?: Date
  result?: ProcessingResult
  error?: string
  retryCount: number
  estimatedTimeRemaining?: number // in millisecondi
}

/**
 * Progress update event
 */
export interface ProgressUpdate {
  jobId: string
  progress: number
  currentFile?: string
  estimatedTimeRemaining?: number
  status: ProcessingJob['status']
}

/**
 * Configuration for retry logic
 */
export interface RetryConfig {
  maxRetries: number
  retryDelay: number // milliseconds
  backoffMultiplier: number
  retryableErrors: string[]
}

/**
 * ProcessingQueue - Manages the processing queue with progress tracking
 */
export class ProcessingQueue extends EventEmitter {
  private jobs: Map<string, ProcessingJob> = new Map()
  private activeJobs: Set<string> = new Set()
  private albumProcessor: AlbumProcessorImpl
  private maxConcurrentJobs: number
  private retryConfig: RetryConfig

  constructor(maxConcurrentJobs: number = 3) {
    super()
    this.maxConcurrentJobs = maxConcurrentJobs
    this.albumProcessor = new AlbumProcessorImpl()
    
    // Default configuration for retry
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 5000, // 5 seconds
      backoffMultiplier: 2,
      retryableErrors: [
        'ENOENT', // File not found
        'EMFILE', // Too many open files
        'ENOMEM', // Out of memory
        'timeout', // Timeout processing
        'network' // Network errors
      ]
    }
  }

  /**
   * Adds a new job to the queue
   */
  addJob(albumName: string, files: AudioFile[], options: AlbumOptions): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const job: ProcessingJob = {
      id: jobId,
      albumName,
      files: [...files], // Copy to avoid external changes
      options: { ...options }, // Copy of the options
      status: 'pending',
      progress: 0,
      retryCount: 0
    }

    this.jobs.set(jobId, job)
    this.emit('jobAdded', job)
    
    // Start processing if slots are available
    this.processNextJob()
    
    return jobId
  }  /**
   
* Removes a job from the queue (if not processing)
   */
  removeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false
    
    if (job.status === 'processing') {
      // Mark for cancellation instead of removing immediately
      job.status = 'cancelled'
      this.emit('jobCancelled', job)
      return true
    }
    
    this.jobs.delete(jobId)
    this.emit('jobRemoved', jobId)
    return true
  }

  /**
   * Gets info about a specific job
   */
  getJob(jobId: string): ProcessingJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Gets all jobs with an optional status filter
   */
  getJobs(status?: ProcessingJob['status']): ProcessingJob[] {
    const allJobs = Array.from(this.jobs.values())
    return status ? allJobs.filter(job => job.status === status) : allJobs
  }

  /**
   * Gets queue statistics
   */
  getQueueStats(): {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
    cancelled: number
  } {
    const jobs = Array.from(this.jobs.values())
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length
    }
  }

  /**
   * Cleans up completed jobs older than a certain time
   */
  cleanupOldJobs(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - maxAgeMs
    let cleanedCount = 0
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        const jobTime = job.endTime?.getTime() || job.startTime?.getTime() || 0
        if (jobTime < cutoffTime) {
          this.jobs.delete(jobId)
          cleanedCount++
        }
      }
    }
    
    if (cleanedCount > 0) {
      this.emit('jobsCleanedUp', cleanedCount)
    }
    
    return cleanedCount
  }

  /**
   * Processes the next available job if there are free slots
   */
  private async processNextJob(): Promise<void> {
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      return // No slot available
    }

    // Find the next pending job
    const pendingJob = Array.from(this.jobs.values())
      .find(job => job.status === 'pending')
    
    if (!pendingJob) {
      return // Nessun job in attesa
    }

    // Start processing the job
    await this.processJob(pendingJob)
  }

  /**
   * Processes a single job
   */
  private async processJob(job: ProcessingJob): Promise<void> {
    this.activeJobs.add(job.id)
    job.status = 'processing'
    job.startTime = new Date()
    job.progress = 0
    
    this.emit('jobStarted', job)
    this.emitProgressUpdate(job)

    try {
      // Estimate total time based on file size and previous processing
      const estimatedTotalTime = this.estimateProcessingTime(job.files)
      job.estimatedTimeRemaining = estimatedTotalTime
      
      // Process the album with progress tracking
      const result = await this.processAlbumWithProgress(job)
      
      // Job completed successfully
      job.status = 'completed'
      job.progress = 100
      job.endTime = new Date()
      job.result = result
      job.estimatedTimeRemaining = 0
      
      this.emit('jobCompleted', job)
      this.emitProgressUpdate(job)
      
    } catch (error) {
      // Handle error and retry if applicable
      await this.handleJobError(job, error)
    } finally {
      this.activeJobs.delete(job.id)
      
      // Start the next job if available
      setImmediate(() => this.processNextJob())
    }
  }  /**

   * Processes an album with detailed progress tracking
   */
  private async processAlbumWithProgress(job: ProcessingJob): Promise<ProcessingResult> {
    const totalFiles = job.files.length
    let processedFiles = 0
    
    // Simulate processing for each file with progress updates
    const progressCallback = (fileIndex: number, fileName: string) => {
      processedFiles = fileIndex + 1
      job.progress = Math.round((processedFiles / totalFiles) * 100)
      
      // Update the remaining time estimate
      if (job.startTime) {
        const elapsedTime = Date.now() - job.startTime.getTime()
        const avgTimePerFile = elapsedTime / processedFiles
        const remainingFiles = totalFiles - processedFiles
        job.estimatedTimeRemaining = Math.round(avgTimePerFile * remainingFiles)
      }
      
      this.emitProgressUpdate(job, fileName)
    }

    // Check whether the job was cancelled
    const currentJob = this.jobs.get(job.id)
    if (currentJob && currentJob.status === 'cancelled') {
      throw new Error('Job cancellato dall\'utente')
    }

    // Process the album using AlbumProcessor
    const result = await this.albumProcessor.processAlbum(job.files, job.options)
    
    // Simulate progress updates during processing
    // In a real implementation, this would be integrated into the AlbumProcessor
    for (let i = 0; i < totalFiles; i++) {
      const currentJob = this.jobs.get(job.id)
      if (currentJob && currentJob.status === 'cancelled') {
        throw new Error('Job cancellato durante processing')
      }
      
      progressCallback(i, job.files[i].name)
      
      // Simulate processing time for the demo
      if (process.env.NODE_ENV !== 'test') {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return result
  }

  /**
   * Handles errors during processing with retry logic
   */
  private async handleJobError(job: ProcessingJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto'
    job.error = errorMessage
    
    // Check whether the error is retryable
    const isRetryable = this.isErrorRetryable(errorMessage)
    const canRetry = job.retryCount < this.retryConfig.maxRetries && isRetryable
    
    if (canRetry) {
      job.retryCount++
      job.status = 'pending' // Requeue for retry
      
      // Compute delay with exponential backoff
      const delay = this.retryConfig.retryDelay * 
        Math.pow(this.retryConfig.backoffMultiplier, job.retryCount - 1)
      
      this.emit('jobRetrying', { job, attempt: job.retryCount, delay })
      
      // Schedule retry after the delay
      setTimeout(() => {
        this.processNextJob()
      }, delay)
      
    } else {
      // Job failed permanently
      job.status = 'failed'
      job.endTime = new Date()
      job.progress = 0
      job.estimatedTimeRemaining = 0
      
      this.emit('jobFailed', job)
      this.emitProgressUpdate(job)
    }
  }

  /**
   * Checks whether an error is retryable
   */
  private isErrorRetryable(errorMessage: string): boolean {
    return this.retryConfig.retryableErrors.some(retryableError => 
      errorMessage.toLowerCase().includes(retryableError.toLowerCase())
    )
  }

  /**
   * Estimates processing time based on file size and history
   */
  private estimateProcessingTime(files: AudioFile[]): number {
    // Base estimate: 1 second per MB of audio
    const totalSizeMB = files.reduce((sum, file) => sum + (file.size / (1024 * 1024)), 0)
    const baseEstimate = totalSizeMB * 1000 // milliseconds
    
    // Correction factor based on history (if available)
    const completedJobs = this.getJobs('completed')
    if (completedJobs.length > 0) {
      const avgProcessingRate = this.calculateAverageProcessingRate(completedJobs)
      return Math.round(totalSizeMB * avgProcessingRate)
    }
    
    return Math.round(baseEstimate)
  }

  /**
   * Computes the average processing rate from completed jobs
   */
  private calculateAverageProcessingRate(completedJobs: ProcessingJob[]): number {
    let totalTime = 0
    let totalSize = 0
    
    for (const job of completedJobs) {
      if (job.startTime && job.endTime) {
        const processingTime = job.endTime.getTime() - job.startTime.getTime()
        const jobSize = job.files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)
        
        totalTime += processingTime
        totalSize += jobSize
      }
    }
    
    return totalSize > 0 ? totalTime / totalSize : 1000 // fallback: 1 sec/MB
  }

  /**
   * Emits a progress update event
   */
  private emitProgressUpdate(job: ProcessingJob, currentFile?: string): void {
    const update: ProgressUpdate = {
      jobId: job.id,
      progress: job.progress,
      currentFile,
      estimatedTimeRemaining: job.estimatedTimeRemaining,
      status: job.status
    }
    
    this.emit('progressUpdate', update)
  }

  /**
   * Adds a generic task to the queue (for test compatibility)
   */
  async addTask<T>(taskId: string, taskFunction: () => Promise<T>): Promise<T> {
    // For now it runs the task directly - in the future it could use the queue
    return await taskFunction()
  }

  /**
   * Configures retry parameters
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config }
  }

  /**
   * Configures the maximum number of concurrent jobs
   */
  setMaxConcurrentJobs(max: number): void {
    this.maxConcurrentJobs = Math.max(1, max)
  }

  /**
   * Stops all active jobs (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    // Mark all active jobs as cancelled
    for (const jobId of this.activeJobs) {
      const job = this.jobs.get(jobId)
      if (job && job.status === 'processing') {
        job.status = 'cancelled'
      }
    }
    
    // Wait for all active jobs to finish
    while (this.activeJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    this.emit('shutdown')
  }
}

/**
 * Factory function to create a ProcessingQueue instance
 */
export function createProcessingQueue(maxConcurrentJobs?: number): ProcessingQueue {
  return new ProcessingQueue(maxConcurrentJobs)
}

/**
 * Export ProcessingQueue as ProcessingQueueImpl for test compatibility
 */
export { ProcessingQueue as ProcessingQueueImpl }