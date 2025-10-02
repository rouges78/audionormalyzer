// GPU-accelerated Audio Processing Worker
// Utilizza Web Workers per offload computazioni pesanti dalla main thread

interface AudioProcessingTask {
  type: 'FFT' | 'SPECTROGRAM' | 'WAVEFORM' | 'ANALYSIS' | 'NORMALIZATION'
  id: string
  data: Float32Array | Float32Array[]
  params: Record<string, any>
}

interface ProcessingResult {
  id: string
  type: string
  result: any
  processingTime: number
  error?: string
}

class GPUAudioProcessor {
  private canvas: OffscreenCanvas | null = null
  private gl: WebGL2RenderingContext | null = null
  private programs: Map<string, WebGLProgram> = new Map()
  private buffers: Map<string, WebGLBuffer> = new Map()
  private textures: Map<string, WebGLTexture> = new Map()
  private framebuffers: Map<string, WebGLFramebuffer> = new Map()

  constructor() {
    this.initializeGPU()
  }

  private initializeGPU() {
    try {
      // Create offscreen canvas for GPU computations
      this.canvas = new OffscreenCanvas(1024, 1024)
      this.gl = this.canvas.getContext('webgl2', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      })

      if (!this.gl) {
        throw new Error('WebGL2 not supported')
      }

      this.initializeShaders()
      console.log('GPU Audio Processor initialized successfully')
    } catch (error) {
      console.warn('GPU initialization failed, falling back to CPU:', error)
    }
  }

  private initializeShaders() {
    if (!this.gl) return

    // FFT Compute Shader (simulated with fragment shader)
    const fftVertexShader = `#version 300 es
      in vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `

    const fftFragmentShader = `#version 300 es
      precision highp float;
      
      uniform sampler2D u_audioData;
      uniform int u_fftSize;
      uniform int u_stage;
      uniform float u_direction;
      
      out vec4 fragColor;
      
      const float PI = 3.14159265359;
      const float TWO_PI = 6.28318530718;
      
      vec2 complexMult(vec2 a, vec2 b) {
        return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
      }
      
      void main() {
        ivec2 coord = ivec2(gl_FragCoord.xy);
        int index = coord.x + coord.y * u_fftSize;
        
        // Cooley-Tukey FFT algorithm
        int step = 1 << u_stage;
        int group = index / step;
        int indexInGroup = index % step;
        
        if (indexInGroup < step / 2) {
          // Butterfly operation
          int partner = index + step / 2;
          vec2 partnerCoord = vec2(partner % u_fftSize, partner / u_fftSize);
          
          vec4 current = texelFetch(u_audioData, coord, 0);
          vec4 partnerData = texelFetch(u_audioData, ivec2(partnerCoord), 0);
          
          float angle = u_direction * TWO_PI * float(indexInGroup) / float(step);
          vec2 twiddle = vec2(cos(angle), sin(angle));
          
          vec2 currentComplex = current.xy;
          vec2 partnerComplex = complexMult(partnerData.xy, twiddle);
          
          vec2 result = currentComplex + partnerComplex;
          fragColor = vec4(result, 0.0, 1.0);
        } else {
          // Second half of butterfly
          int partner = index - step / 2;
          vec2 partnerCoord = vec2(partner % u_fftSize, partner / u_fftSize);
          
          vec4 current = texelFetch(u_audioData, coord, 0);
          vec4 partnerData = texelFetch(u_audioData, ivec2(partnerCoord), 0);
          
          float angle = u_direction * TWO_PI * float(indexInGroup - step / 2) / float(step);
          vec2 twiddle = vec2(cos(angle), sin(angle));
          
          vec2 currentComplex = current.xy;
          vec2 partnerComplex = complexMult(partnerData.xy, twiddle);
          
          vec2 result = currentComplex - partnerComplex;
          fragColor = vec4(result, 0.0, 1.0);
        }
      }
    `

    // Spectrogram generation shader
    const spectrogramFragmentShader = `#version 300 es
      precision highp float;
      
      uniform sampler2D u_fftData;
      uniform int u_timeIndex;
      uniform int u_frequencyBands;
      uniform float u_windowFunction;
      
      out vec4 fragColor;
      
      void main() {
        ivec2 coord = ivec2(gl_FragCoord.xy);
        int freqIndex = coord.x;
        
        if (freqIndex >= u_frequencyBands) {
          fragColor = vec4(0.0);
          return;
        }
        
        // Get FFT magnitude
        vec4 fftValue = texelFetch(u_fftData, ivec2(freqIndex, 0), 0);
        float magnitude = sqrt(fftValue.x * fftValue.x + fftValue.y * fftValue.y);
        
        // Convert to dB scale
        float dB = 20.0 * log(magnitude + 1e-10) / log(10.0);
        
        // Normalize to 0-1 range
        float normalized = clamp((dB + 100.0) / 100.0, 0.0, 1.0);
        
        fragColor = vec4(normalized, normalized, normalized, 1.0);
      }
    `

    // Waveform processing shader
    const waveformFragmentShader = `#version 300 es
      precision highp float;
      
      uniform sampler2D u_audioData;
      uniform int u_sampleRate;
      uniform float u_timeWindow;
      uniform vec3 u_colorScheme;
      
      out vec4 fragColor;
      
      void main() {
        vec2 coord = gl_FragCoord.xy / vec2(1024.0);
        
        // Sample audio data
        float sample = texture(u_audioData, coord).r;
        
        // Apply color scheme
        vec3 color = u_colorScheme * abs(sample);
        
        // Add glow effect
        float glow = smoothstep(0.0, 1.0, abs(sample));
        color += vec3(glow * 0.2);
        
        fragColor = vec4(color, 1.0);
      }
    `

    // Create shader programs
    this.programs.set('fft', this.createProgram(fftVertexShader, fftFragmentShader))
    this.programs.set('spectrogram', this.createProgram(fftVertexShader, spectrogramFragmentShader))
    this.programs.set('waveform', this.createProgram(fftVertexShader, waveformFragmentShader))
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram | null {
    if (!this.gl) return null

    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource)

    if (!vertexShader || !fragmentShader) return null

    const program = this.gl.createProgram()
    if (!program) return null

    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program linking failed:', this.gl.getProgramInfoLog(program))
      return null
    }

    return program
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null

    const shader = this.gl.createShader(type)
    if (!shader) return null

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation failed:', this.gl.getShaderInfoLog(shader))
      return null
    }

    return shader
  }

  async processFFT(audioData: Float32Array, fftSize: number = 2048): Promise<Float32Array> {
    const startTime = performance.now()

    if (this.gl && this.programs.has('fft')) {
      try {
        const result = await this.processFFTGPU(audioData, fftSize)
        const processingTime = performance.now() - startTime
        console.log(`GPU FFT processing time: ${processingTime.toFixed(2)}ms`)
        return result
      } catch (error) {
        console.warn('GPU FFT failed, falling back to CPU:', error)
      }
    }

    // Fallback to CPU FFT
    const result = this.processFFTCPU(audioData, fftSize)
    const processingTime = performance.now() - startTime
    console.log(`CPU FFT processing time: ${processingTime.toFixed(2)}ms`)
    return result
  }

  private async processFFTGPU(audioData: Float32Array, fftSize: number): Promise<Float32Array> {
    if (!this.gl) throw new Error('WebGL not available')

    const program = this.programs.get('fft')
    if (!program) throw new Error('FFT program not available')

    // Create texture for audio data
    const audioTexture = this.createAudioTexture(audioData, fftSize)
    
    // Create framebuffer for output
    const outputFramebuffer = this.gl.createFramebuffer()
    const outputTexture = this.gl.createTexture()
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, outputTexture)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, fftSize, 1, 0, this.gl.RGBA, this.gl.FLOAT, null)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)
    
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, outputFramebuffer)
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, outputTexture, 0)
    
    // Set up rendering
    this.gl.viewport(0, 0, fftSize, 1)
    this.gl.useProgram(program)
    
    // Set uniforms
    const audioDataLocation = this.gl.getUniformLocation(program, 'u_audioData')
    const fftSizeLocation = this.gl.getUniformLocation(program, 'u_fftSize')
    const stageLocation = this.gl.getUniformLocation(program, 'u_stage')
    const directionLocation = this.gl.getUniformLocation(program, 'u_direction')
    
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, audioTexture)
    this.gl.uniform1i(audioDataLocation, 0)
    this.gl.uniform1i(fftSizeLocation, fftSize)
    this.gl.uniform1f(directionLocation, -1.0) // Forward FFT
    
    // Perform FFT stages
    const stages = Math.log2(fftSize)
    for (let stage = 0; stage < stages; stage++) {
      this.gl.uniform1i(stageLocation, stage)
      this.renderQuad()
    }
    
    // Read result
    const result = new Float32Array(fftSize * 4)
    this.gl.readPixels(0, 0, fftSize, 1, this.gl.RGBA, this.gl.FLOAT, result)
    
    // Extract magnitude
    const magnitude = new Float32Array(fftSize)
    for (let i = 0; i < fftSize; i++) {
      const real = result[i * 4]
      const imag = result[i * 4 + 1]
      magnitude[i] = Math.sqrt(real * real + imag * imag)
    }
    
    // Cleanup
    this.gl.deleteTexture(audioTexture)
    this.gl.deleteTexture(outputTexture)
    this.gl.deleteFramebuffer(outputFramebuffer)
    
    return magnitude
  }

  private processFFTCPU(audioData: Float32Array, fftSize: number): Float32Array {
    // Simple DFT implementation (for demonstration - use a proper FFT library in production)
    const result = new Float32Array(fftSize)
    
    for (let k = 0; k < fftSize; k++) {
      let real = 0
      let imag = 0
      
      for (let n = 0; n < Math.min(audioData.length, fftSize); n++) {
        const angle = -2 * Math.PI * k * n / fftSize
        real += audioData[n] * Math.cos(angle)
        imag += audioData[n] * Math.sin(angle)
      }
      
      result[k] = Math.sqrt(real * real + imag * imag)
    }
    
    return result
  }

  private createAudioTexture(audioData: Float32Array, fftSize: number): WebGLTexture | null {
    if (!this.gl) return null

    const texture = this.gl.createTexture()
    if (!texture) return null

    // Pad or truncate audio data to fftSize
    const paddedData = new Float32Array(fftSize * 4) // RGBA
    for (let i = 0; i < fftSize; i++) {
      paddedData[i * 4] = i < audioData.length ? audioData[i] : 0 // Real part
      paddedData[i * 4 + 1] = 0 // Imaginary part
      paddedData[i * 4 + 2] = 0
      paddedData[i * 4 + 3] = 1
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, fftSize, 1, 0, this.gl.RGBA, this.gl.FLOAT, paddedData)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)

    return texture
  }

  private renderQuad() {
    if (!this.gl) return

    // Create quad vertices if not exists
    if (!this.buffers.has('quad')) {
      const vertices = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1
      ])

      const buffer = this.gl.createBuffer()
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
      this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW)
      this.buffers.set('quad', buffer)
    }

    const quadBuffer = this.buffers.get('quad')
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, quadBuffer)
    this.gl.enableVertexAttribArray(0)
    this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0)
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }

  async generateSpectrogram(audioData: Float32Array, params: {
    fftSize?: number
    hopSize?: number
    frequencyBands?: number
    timeSegments?: number
  }): Promise<Float32Array> {
    const {
      fftSize = 2048,
      hopSize = 512,
      frequencyBands = 128,
      timeSegments = 256
    } = params

    const startTime = performance.now()
    const spectrogram = new Float32Array(timeSegments * frequencyBands)

    // Process audio in overlapping windows
    for (let t = 0; t < timeSegments; t++) {
      const startSample = t * hopSize
      const windowData = audioData.slice(startSample, startSample + fftSize)
      
      // Apply windowing function
      this.applyHannWindow(windowData)
      
      // Compute FFT
      const spectrum = await this.processFFT(windowData, fftSize)
      
      // Extract frequency bands
      for (let f = 0; f < frequencyBands; f++) {
        const binIndex = Math.floor((f / frequencyBands) * (fftSize / 2))
        spectrogram[t * frequencyBands + f] = spectrum[binIndex]
      }
    }

    const processingTime = performance.now() - startTime
    console.log(`Spectrogram generation time: ${processingTime.toFixed(2)}ms`)

    return spectrogram
  }

  private applyHannWindow(data: Float32Array) {
    const N = data.length
    for (let i = 0; i < N; i++) {
      const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)))
      data[i] *= window
    }
  }

  async analyzeAudio(audioData: Float32Array): Promise<{
    peak: number
    rms: number
    zeroCrossings: number
    spectralCentroid: number
    spectralRolloff: number
  }> {
    const startTime = performance.now()

    // Peak analysis
    const peak = this.findPeak(audioData)
    
    // RMS analysis
    const rms = this.calculateRMS(audioData)
    
    // Zero crossings
    const zeroCrossings = this.countZeroCrossings(audioData)
    
    // Spectral features
    const spectrum = await this.processFFT(audioData)
    const spectralCentroid = this.calculateSpectralCentroid(spectrum)
    const spectralRolloff = this.calculateSpectralRolloff(spectrum)

    const processingTime = performance.now() - startTime
    console.log(`Audio analysis time: ${processingTime.toFixed(2)}ms`)

    return {
      peak,
      rms,
      zeroCrossings,
      spectralCentroid,
      spectralRolloff
    }
  }

  private findPeak(data: Float32Array): number {
    let peak = 0
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]))
    }
    return peak
  }

  private calculateRMS(data: Float32Array): number {
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i]
    }
    return Math.sqrt(sum / data.length)
  }

  private countZeroCrossings(data: Float32Array): number {
    let crossings = 0
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0) !== (data[i-1] >= 0)) {
        crossings++
      }
    }
    return crossings
  }

  private calculateSpectralCentroid(spectrum: Float32Array): number {
    let numerator = 0
    let denominator = 0
    
    for (let i = 0; i < spectrum.length; i++) {
      numerator += i * spectrum[i]
      denominator += spectrum[i]
    }
    
    return denominator > 0 ? numerator / denominator : 0
  }

  private calculateSpectralRolloff(spectrum: Float32Array, threshold: number = 0.85): number {
    let totalEnergy = 0
    for (let i = 0; i < spectrum.length; i++) {
      totalEnergy += spectrum[i]
    }
    
    const targetEnergy = totalEnergy * threshold
    let cumulativeEnergy = 0
    
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i]
      if (cumulativeEnergy >= targetEnergy) {
        return i / spectrum.length
      }
    }
    
    return 1.0
  }
}

// Worker instance
const processor = new GPUAudioProcessor()

// Message handler
self.onmessage = async (event: MessageEvent<AudioProcessingTask>) => {
  const { type, id, data, params } = event.data
  const startTime = performance.now()

  try {
    let result: any

    switch (type) {
      case 'FFT':
        result = await processor.processFFT(data as Float32Array, params.fftSize)
        break

      case 'SPECTROGRAM':
        result = await processor.generateSpectrogram(data as Float32Array, params)
        break

      case 'ANALYSIS':
        result = await processor.analyzeAudio(data as Float32Array)
        break

      default:
        throw new Error(`Unknown processing type: ${type}`)
    }

    const processingTime = performance.now() - startTime

    const response: ProcessingResult = {
      id,
      type,
      result,
      processingTime
    }

    self.postMessage(response)

  } catch (error) {
    const response: ProcessingResult = {
      id,
      type,
      result: null,
      processingTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }

    self.postMessage(response)
  }
}

// Export types for TypeScript
export type { AudioProcessingTask, ProcessingResult }