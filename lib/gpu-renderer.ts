import { AudioAnalysis } from '@/types/audio'

// WebGPU type declarations for browsers that support it
declare global {
  interface Navigator {
    gpu?: GPU
  }
}

// WebGPU type definitions
interface GPU {
  requestAdapter(options?: {
    powerPreference?: 'low-power' | 'high-performance'
    forceFallbackAdapter?: boolean
  }): Promise<GPUAdapter | null>
}

interface GPUAdapter {
  requestDevice(descriptor?: {
    requiredFeatures?: string[]
    requiredLimits?: Record<string, number>
  }): Promise<GPUDevice>
  features: Set<string>
  limits: Record<string, number>
  info: {
    vendor: string
    architecture: string
    device: string
    description: string
  }
}

interface GPUDevice {
  features: Set<string>
  limits: Record<string, number>
  lost: Promise<{ reason: 'destroyed' | 'unknown'; message: string }>
  createBuffer(descriptor: {
    size: number
    usage: number
    mappedAtCreation?: boolean
  }): GPUBuffer
  createTexture(descriptor: {
    size: { width: number; height: number; depthOrArrayLayers?: number }
    format: string
    usage: number
  }): GPUTexture
  createCommandEncoder(): GPUCommandEncoder
  queue: GPUQueue
  destroy(): void
}

interface GPUBuffer {
  size: number
  usage: number
  mapState: 'unmapped' | 'pending' | 'mapped'
  mapAsync(mode: number, offset?: number, size?: number): Promise<void>
  getMappedRange(offset?: number, size?: number): ArrayBuffer
  unmap(): void
  destroy(): void
}

interface GPUTexture {
  width: number
  height: number
  depthOrArrayLayers: number
  format: string
  usage: number
  createView(descriptor?: {
    format?: string
    dimension?: string
    aspect?: string
  }): GPUTextureView
  destroy(): void
}

interface GPUTextureView {}

interface GPUCommandEncoder {
  beginRenderPass(descriptor: {
    colorAttachments: {
      view: GPUTextureView
      loadOp: 'load' | 'clear'
      storeOp: 'store' | 'discard'
      clearValue?: { r: number; g: number; b: number; a: number }
    }[]
  }): GPURenderPassEncoder
  finish(): GPUCommandBuffer
}

interface GPURenderPassEncoder {
  end(): void
}

interface GPUCommandBuffer {}

interface GPUQueue {
  submit(commandBuffers: GPUCommandBuffer[]): void
  writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: ArrayBuffer | ArrayBufferView): void
  writeTexture(
    destination: { texture: GPUTexture },
    data: ArrayBuffer | ArrayBufferView,
    dataLayout: { bytesPerRow: number; rowsPerImage?: number },
    size: { width: number; height: number; depthOrArrayLayers?: number }
  ): void
}

interface RenderTask {
  id: string
  type: 'waveform' | 'spectrogram' | 'histogram' | 'vectorscope'
  priority: 'low' | 'medium' | 'high' | 'critical'
  data: any
  callback: (result: any) => void
  onError: (error: Error) => void
}

interface GPUCapabilities {
  webgl2: boolean
  webgpu: boolean
  maxTextureSize: number
  maxComputeWorkGroups: number
  shaderVersion: string
  extensions: string[]
}

interface RenderSettings {
  quality: 'low' | 'medium' | 'high' | 'ultra'
  antialiasing: boolean
  vsync: boolean
  powerPreference: 'low-power' | 'high-performance'
  framerateCap: number
}

export class GPURendererManager {
  private worker: Worker | null = null
  private canvas: HTMLCanvasElement | null = null
  private offscreenCanvas: OffscreenCanvas | null = null
  private gl: WebGL2RenderingContext | null = null
  private gpu: GPU | null = null
  private device: GPUDevice | null = null
  
  private renderQueue: Map<string, RenderTask> = new Map()
  private activeRenders: Set<string> = new Set()
  private capabilities: GPUCapabilities | null = null
  private settings: RenderSettings = {
    quality: 'high',
    antialiasing: true,
    vsync: true,
    powerPreference: 'high-performance',
    framerateCap: 60
  }

  private frameCount = 0
  private lastFrameTime = 0
  private fps = 0
  private renderStats = {
    framesRendered: 0,
    averageFrameTime: 0,
    gpuMemoryUsed: 0,
    activeTasks: 0
  }

  constructor() {
    this.initialize()
  }

  private async initialize() {
    try {
      // Detect GPU capabilities
      await this.detectCapabilities()
      
      // Initialize WebGPU if available, fallback to WebGL2
      if (this.capabilities?.webgpu) {
        await this.initializeWebGPU()
      } else if (this.capabilities?.webgl2) {
        this.initializeWebGL2()
      }
      
      // Initialize worker for heavy computations
      this.initializeWorker()
      
      // Start render loop
      this.startRenderLoop()
      
      console.log('🚀 GPU Renderer Manager initialized successfully')
      console.log('📊 Capabilities:', this.capabilities)
      
    } catch (error) {
      console.error('❌ GPU Renderer initialization failed:', error)
      throw error
    }
  }

  private async detectCapabilities(): Promise<void> {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    
    // Check WebGPU availability
    const webgpu = 'gpu' in navigator
    
    if (gl) {
      const capabilities: GPUCapabilities = {
        webgl2: true,
        webgpu,
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxComputeWorkGroups: 0, // WebGL doesn't have compute shaders
        shaderVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        extensions: gl.getSupportedExtensions() || []
      }
      
      this.capabilities = capabilities
    } else {
      throw new Error('WebGL2 not supported')
    }
  }

  private async initializeWebGPU(): Promise<void> {
    if (!('gpu' in navigator)) {
      throw new Error('WebGPU not supported')
    }

    try {
      this.gpu = navigator.gpu
      const adapter = await this.gpu.requestAdapter({
        powerPreference: this.settings.powerPreference
      })

      if (!adapter) {
        throw new Error('No WebGPU adapter available')
      }

      this.device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {}
      })

      console.log('✅ WebGPU initialized successfully')
    } catch (error) {
      console.warn('⚠️ WebGPU initialization failed, falling back to WebGL2:', error)
      throw error
    }
  }

  private initializeWebGL2(): void {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    
    this.canvas = canvas
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      depth: true,
      stencil: false,
      antialias: this.settings.antialiasing,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: this.settings.powerPreference
    })

    if (!this.gl) {
      throw new Error('Failed to create WebGL2 context')
    }

    // Create offscreen canvas for background rendering
    this.offscreenCanvas = canvas.transferControlToOffscreen()
    
    console.log('✅ WebGL2 initialized successfully')
  }

  private initializeWorker(): void {
    try {
      this.worker = new Worker(
        new URL('../workers/gpu-audio-processor.worker.ts', import.meta.url),
        { type: 'module' }
      )

      this.worker.onmessage = (event) => {
        const { id, result, error } = event.data
        const task = this.renderQueue.get(id)
        
        if (task) {
          this.activeRenders.delete(id)
          this.renderQueue.delete(id)
          
          if (error) {
            task.onError(new Error(error))
          } else {
            task.callback(result)
          }
        }
      }

      this.worker.onerror = (error) => {
        console.error('🔴 Worker error:', error)
      }

      console.log('✅ GPU Audio Processing Worker initialized')
    } catch (error) {
      console.warn('⚠️ Worker initialization failed:', error)
    }
  }

  private startRenderLoop(): void {
    const renderFrame = (timestamp: number) => {
      this.updateStats(timestamp)
      this.processRenderQueue()
      
      // Schedule next frame
      if (this.settings.vsync) {
        requestAnimationFrame(renderFrame)
      } else {
        setTimeout(() => requestAnimationFrame(renderFrame), 1000 / this.settings.framerateCap)
      }
    }

    requestAnimationFrame(renderFrame)
  }

  private updateStats(timestamp: number): void {
    this.frameCount++
    
    if (this.lastFrameTime > 0) {
      const frameTime = timestamp - this.lastFrameTime
      this.renderStats.averageFrameTime = (this.renderStats.averageFrameTime * 0.9) + (frameTime * 0.1)
    }
    
    this.lastFrameTime = timestamp
    
    // Update FPS every second
    if (this.frameCount % 60 === 0) {
      this.fps = Math.round(1000 / this.renderStats.averageFrameTime)
    }
    
    this.renderStats.framesRendered = this.frameCount
    this.renderStats.activeTasks = this.activeRenders.size
  }

  private processRenderQueue(): void {
    // Process high priority tasks first
    const sortedTasks = Array.from(this.renderQueue.values()).sort((a, b) => {
      const priorities = { critical: 4, high: 3, medium: 2, low: 1 }
      return priorities[b.priority] - priorities[a.priority]
    })

    // Limit concurrent renders based on performance
    const maxConcurrent = this.getMaxConcurrentRenders()
    
    for (const task of sortedTasks) {
      if (this.activeRenders.size >= maxConcurrent) break
      if (this.activeRenders.has(task.id)) continue
      
      this.executeRenderTask(task)
    }
  }

  private getMaxConcurrentRenders(): number {
    switch (this.settings.quality) {
      case 'ultra': return 8
      case 'high': return 6
      case 'medium': return 4
      case 'low': return 2
      default: return 4
    }
  }

  private executeRenderTask(task: RenderTask): void {
    this.activeRenders.add(task.id)
    
    if (this.worker) {
      // Offload to worker for heavy computations
      this.worker.postMessage({
        type: task.type.toUpperCase(),
        id: task.id,
        data: task.data,
        params: this.getTaskParams(task.type)
      })
    } else {
      // Execute locally if worker not available
      this.executeTaskLocally(task)
    }
  }

  private executeTaskLocally(task: RenderTask): void {
    try {
      let result: any

      switch (task.type) {
        case 'waveform':
          result = this.renderWaveform(task.data)
          break
        case 'spectrogram':
          result = this.renderSpectrogram(task.data)
          break
        case 'histogram':
          result = this.renderHistogram(task.data)
          break
        case 'vectorscope':
          result = this.renderVectorScope(task.data)
          break
        default:
          throw new Error(`Unknown render task type: ${task.type}`)
      }

      this.activeRenders.delete(task.id)
      this.renderQueue.delete(task.id)
      task.callback(result)
      
    } catch (error) {
      this.activeRenders.delete(task.id)
      this.renderQueue.delete(task.id)
      task.onError(error as Error)
    }
  }

  private getTaskParams(type: string): Record<string, any> {
    const baseParams = {
      quality: this.settings.quality,
      antialiasing: this.settings.antialiasing
    }

    switch (type) {
      case 'waveform':
        return {
          ...baseParams,
          resolution: this.settings.quality === 'ultra' ? 4096 : 2048,
          smoothing: true
        }
      case 'spectrogram':
        return {
          ...baseParams,
          fftSize: this.settings.quality === 'ultra' ? 4096 : 2048,
          frequencyBands: this.settings.quality === 'ultra' ? 256 : 128,
          timeSegments: 512
        }
      case 'histogram':
        return {
          ...baseParams,
          bins: this.settings.quality === 'ultra' ? 256 : 128,
          smoothing: true
        }
      case 'vectorscope':
        return {
          ...baseParams,
          resolution: this.settings.quality === 'ultra' ? 512 : 256,
          persistence: 0.8
        }
      default:
        return baseParams
    }
  }

  // Public API methods
  async renderWaveformGPU(
    audioData: Float32Array, 
    options: { 
      width?: number
      height?: number
      color?: string
      style?: 'line' | 'filled' | 'bars'
    } = {}
  ): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const taskId = this.generateTaskId()
      
      const task: RenderTask = {
        id: taskId,
        type: 'waveform',
        priority: 'medium',
        data: { audioData, options },
        callback: resolve,
        onError: reject
      }
      
      this.renderQueue.set(taskId, task)
    })
  }

  async renderSpectrogramGPU(
    audioData: Float32Array,
    options: {
      fftSize?: number
      hopSize?: number
      colormap?: string
      logarithmic?: boolean
    } = {}
  ): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const taskId = this.generateTaskId()
      
      const task: RenderTask = {
        id: taskId,
        type: 'spectrogram',
        priority: 'high',
        data: { audioData, options },
        callback: resolve,
        onError: reject
      }
      
      this.renderQueue.set(taskId, task)
    })
  }

  async renderHistogramGPU(
    audioData: Float32Array,
    options: {
      bins?: number
      range?: [number, number]
      logarithmic?: boolean
    } = {}
  ): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const taskId = this.generateTaskId()
      
      const task: RenderTask = {
        id: taskId,
        type: 'histogram',
        priority: 'low',
        data: { audioData, options },
        callback: resolve,
        onError: reject
      }
      
      this.renderQueue.set(taskId, task)
    })
  }

  async renderVectorScopeGPU(
    leftChannel: Float32Array,
    rightChannel: Float32Array,
    options: {
      size?: number
      persistence?: number
      color?: string
    } = {}
  ): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const taskId = this.generateTaskId()
      
      const task: RenderTask = {
        id: taskId,
        type: 'vectorscope',
        priority: 'medium',
        data: { leftChannel, rightChannel, options },
        callback: resolve,
        onError: reject
      }
      
      this.renderQueue.set(taskId, task)
    })
  }

  // Fallback CPU rendering methods
  private renderWaveform(data: any): ImageData {
    const { audioData, options } = data
    const { width = 1024, height = 256, color = '#00ffff', style = 'line' } = options
    
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0)'
    ctx.fillRect(0, 0, width, height)
    
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    
    const centerY = height / 2
    const step = audioData.length / width
    
    for (let x = 0; x < width; x++) {
      const index = Math.floor(x * step)
      const y = centerY + (audioData[index] * centerY * 0.8)
      
      if (x === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    
    ctx.stroke()
    return ctx.getImageData(0, 0, width, height)
  }

  private renderSpectrogram(data: any): ImageData {
    // Simplified CPU implementation
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    
    // Generate placeholder spectrogram
    const imageData = ctx.createImageData(512, 256)
    for (let i = 0; i < imageData.data.length; i += 4) {
      const intensity = Math.random()
      imageData.data[i] = intensity * 255     // R
      imageData.data[i + 1] = intensity * 128 // G
      imageData.data[i + 2] = intensity * 64  // B
      imageData.data[i + 3] = 255             // A
    }
    
    return imageData
  }

  private renderHistogram(data: any): ImageData {
    // Simplified CPU implementation
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    
    // Generate placeholder histogram
    ctx.fillStyle = 'rgba(0, 255, 255, 0.7)'
    for (let i = 0; i < 256; i++) {
      const height = Math.random() * 200 + 20
      ctx.fillRect(i, 256 - height, 1, height)
    }
    
    return ctx.getImageData(0, 0, 256, 256)
  }

  private renderVectorScope(data: any): ImageData {
    // Simplified CPU implementation
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0)'
    ctx.fillRect(0, 0, 256, 256)
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.beginPath()
    ctx.moveTo(128, 0)
    ctx.lineTo(128, 256)
    ctx.moveTo(0, 128)
    ctx.lineTo(256, 128)
    ctx.stroke()
    
    // Draw sample points
    ctx.fillStyle = 'rgba(0, 255, 255, 0.6)'
    for (let i = 0; i < 1000; i++) {
      const x = (Math.random() - 0.5) * 200 + 128
      const y = (Math.random() - 0.5) * 200 + 128
      ctx.fillRect(x, y, 1, 1)
    }
    
    return ctx.getImageData(0, 0, 256, 256)
  }

  // Utility methods
  private generateTaskId(): string {
    return `render_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  updateSettings(newSettings: Partial<RenderSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    console.log('🔧 GPU Renderer settings updated:', this.settings)
  }

  getStats() {
    return {
      ...this.renderStats,
      fps: this.fps,
      capabilities: this.capabilities,
      settings: this.settings
    }
  }

  clearQueue(): void {
    this.renderQueue.clear()
    this.activeRenders.clear()
  }

  destroy(): void {
    this.clearQueue()
    
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    
    if (this.device) {
      this.device.destroy()
      this.device = null
    }
    
    this.gl = null
    this.canvas = null
    this.offscreenCanvas = null
  }
}

// Singleton instance
export const gpuRenderer = new GPURendererManager()