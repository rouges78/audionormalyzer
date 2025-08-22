import { EventEmitter } from 'events'
import { AudioFile, ProcessingResult, AlbumOptions } from '@/types/audio'
import { AlbumProcessorImpl } from './album-processor'

/**
 * Stato di un job nella coda di processing
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
 * Evento di aggiornamento progresso
 */
export interface ProgressUpdate {
  jobId: string
  progress: number
  currentFile?: string
  estimatedTimeRemaining?: number
  status: ProcessingJob['status']
}

/**
 * Configurazione per retry logic
 */
export interface RetryConfig {
  maxRetries: number
  retryDelay: number // millisecondi
  backoffMultiplier: number
  retryableErrors: string[]
}

/**
 * ProcessingQueue - Gestisce la coda di processing con tracking del progresso
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
    
    // Configurazione default per retry
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 5000, // 5 secondi
      backoffMultiplier: 2,
      retryableErrors: [
        'ENOENT', // File non trovato
        'EMFILE', // Troppi file aperti
        'ENOMEM', // Memoria insufficiente
        'timeout', // Timeout processing
        'network' // Errori di rete
      ]
    }
  }

  /**
   * Aggiunge un nuovo job alla coda
   */
  addJob(albumName: string, files: AudioFile[], options: AlbumOptions): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const job: ProcessingJob = {
      id: jobId,
      albumName,
      files: [...files], // Copia per evitare modifiche esterne
      options: { ...options }, // Copia delle opzioni
      status: 'pending',
      progress: 0,
      retryCount: 0
    }

    this.jobs.set(jobId, job)
    this.emit('jobAdded', job)
    
    // Avvia processing se ci sono slot disponibili
    this.processNextJob()
    
    return jobId
  }  /**
   
* Rimuove un job dalla coda (se non in processing)
   */
  removeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false
    
    if (job.status === 'processing') {
      // Marca per cancellazione invece di rimuovere immediatamente
      job.status = 'cancelled'
      this.emit('jobCancelled', job)
      return true
    }
    
    this.jobs.delete(jobId)
    this.emit('jobRemoved', jobId)
    return true
  }

  /**
   * Ottiene informazioni su un job specifico
   */
  getJob(jobId: string): ProcessingJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Ottiene tutti i job con filtro opzionale per status
   */
  getJobs(status?: ProcessingJob['status']): ProcessingJob[] {
    const allJobs = Array.from(this.jobs.values())
    return status ? allJobs.filter(job => job.status === status) : allJobs
  }

  /**
   * Ottiene statistiche della coda
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
   * Pulisce job completati più vecchi di un certo tempo
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
   * Processa il prossimo job disponibile se ci sono slot liberi
   */
  private async processNextJob(): Promise<void> {
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      return // Nessun slot disponibile
    }

    // Trova il prossimo job pending
    const pendingJob = Array.from(this.jobs.values())
      .find(job => job.status === 'pending')
    
    if (!pendingJob) {
      return // Nessun job in attesa
    }

    // Avvia processing del job
    await this.processJob(pendingJob)
  }

  /**
   * Processa un singolo job
   */
  private async processJob(job: ProcessingJob): Promise<void> {
    this.activeJobs.add(job.id)
    job.status = 'processing'
    job.startTime = new Date()
    job.progress = 0
    
    this.emit('jobStarted', job)
    this.emitProgressUpdate(job)

    try {
      // Stima tempo totale basata su dimensione file e processing precedenti
      const estimatedTotalTime = this.estimateProcessingTime(job.files)
      job.estimatedTimeRemaining = estimatedTotalTime
      
      // Processa l'album con tracking del progresso
      const result = await this.processAlbumWithProgress(job)
      
      // Job completato con successo
      job.status = 'completed'
      job.progress = 100
      job.endTime = new Date()
      job.result = result
      job.estimatedTimeRemaining = 0
      
      this.emit('jobCompleted', job)
      this.emitProgressUpdate(job)
      
    } catch (error) {
      // Gestisce errore e retry se applicabile
      await this.handleJobError(job, error)
    } finally {
      this.activeJobs.delete(job.id)
      
      // Avvia il prossimo job se disponibile
      setImmediate(() => this.processNextJob())
    }
  }  /**

   * Processa album con tracking dettagliato del progresso
   */
  private async processAlbumWithProgress(job: ProcessingJob): Promise<ProcessingResult> {
    const totalFiles = job.files.length
    let processedFiles = 0
    
    // Simula processing per ogni file con aggiornamenti di progresso
    const progressCallback = (fileIndex: number, fileName: string) => {
      processedFiles = fileIndex + 1
      job.progress = Math.round((processedFiles / totalFiles) * 100)
      
      // Aggiorna stima tempo rimanente
      if (job.startTime) {
        const elapsedTime = Date.now() - job.startTime.getTime()
        const avgTimePerFile = elapsedTime / processedFiles
        const remainingFiles = totalFiles - processedFiles
        job.estimatedTimeRemaining = Math.round(avgTimePerFile * remainingFiles)
      }
      
      this.emitProgressUpdate(job, fileName)
    }

    // Verifica se job è stato cancellato
    if (job.status === 'cancelled') {
      throw new Error('Job cancellato dall\'utente')
    }

    // Processa l'album usando AlbumProcessor
    const result = await this.albumProcessor.processAlbum(job.files, job.options)
    
    // Simula aggiornamenti di progresso durante il processing
    // In una implementazione reale, questo sarebbe integrato nel AlbumProcessor
    for (let i = 0; i < totalFiles; i++) {
      if (job.status === 'cancelled') {
        throw new Error('Job cancellato durante processing')
      }
      
      progressCallback(i, job.files[i].name)
      
      // Simula tempo di processing per demo
      if (process.env.NODE_ENV !== 'test') {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return result
  }

  /**
   * Gestisce errori durante il processing con retry logic
   */
  private async handleJobError(job: ProcessingJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto'
    job.error = errorMessage
    
    // Verifica se l'errore è ritentabile
    const isRetryable = this.isErrorRetryable(errorMessage)
    const canRetry = job.retryCount < this.retryConfig.maxRetries && isRetryable
    
    if (canRetry) {
      job.retryCount++
      job.status = 'pending' // Rimette in coda per retry
      
      // Calcola delay con backoff esponenziale
      const delay = this.retryConfig.retryDelay * 
        Math.pow(this.retryConfig.backoffMultiplier, job.retryCount - 1)
      
      this.emit('jobRetrying', { job, attempt: job.retryCount, delay })
      
      // Schedula retry dopo delay
      setTimeout(() => {
        this.processNextJob()
      }, delay)
      
    } else {
      // Job fallito definitivamente
      job.status = 'failed'
      job.endTime = new Date()
      job.progress = 0
      job.estimatedTimeRemaining = 0
      
      this.emit('jobFailed', job)
      this.emitProgressUpdate(job)
    }
  }

  /**
   * Verifica se un errore è ritentabile
   */
  private isErrorRetryable(errorMessage: string): boolean {
    return this.retryConfig.retryableErrors.some(retryableError => 
      errorMessage.toLowerCase().includes(retryableError.toLowerCase())
    )
  }

  /**
   * Stima il tempo di processing basato su dimensione file e storico
   */
  private estimateProcessingTime(files: AudioFile[]): number {
    // Stima base: 1 secondo per MB di audio
    const totalSizeMB = files.reduce((sum, file) => sum + (file.size / (1024 * 1024)), 0)
    const baseEstimate = totalSizeMB * 1000 // millisecondi
    
    // Fattore di correzione basato su storico (se disponibile)
    const completedJobs = this.getJobs('completed')
    if (completedJobs.length > 0) {
      const avgProcessingRate = this.calculateAverageProcessingRate(completedJobs)
      return Math.round(totalSizeMB * avgProcessingRate)
    }
    
    return Math.round(baseEstimate)
  }

  /**
   * Calcola il rate medio di processing dai job completati
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
   * Emette evento di aggiornamento progresso
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
   * Configura parametri di retry
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config }
  }

  /**
   * Configura numero massimo di job concorrenti
   */
  setMaxConcurrentJobs(max: number): void {
    this.maxConcurrentJobs = Math.max(1, max)
  }

  /**
   * Ferma tutti i job attivi (per shutdown graceful)
   */
  async shutdown(): Promise<void> {
    // Marca tutti i job attivi come cancellati
    for (const jobId of this.activeJobs) {
      const job = this.jobs.get(jobId)
      if (job && job.status === 'processing') {
        job.status = 'cancelled'
      }
    }
    
    // Attende che tutti i job attivi terminino
    while (this.activeJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    this.emit('shutdown')
  }
}

/**
 * Factory function per creare istanza ProcessingQueue
 */
export function createProcessingQueue(maxConcurrentJobs?: number): ProcessingQueue {
  return new ProcessingQueue(maxConcurrentJobs)
}