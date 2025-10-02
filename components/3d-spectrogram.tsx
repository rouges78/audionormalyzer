import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { AudioAnalysis } from '@/types/audio'
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  Maximize2,
  Volume2,
  Zap
} from 'lucide-react'

interface Spectrogram3DProps {
  analysis: AudioAnalysis
  fileName: string
  audioData?: Float32Array
  className?: string
}

interface WebGLState {
  gl: WebGLRenderingContext | null
  program: WebGLProgram | null
  vertexBuffer: WebGLBuffer | null
  indexBuffer: WebGLBuffer | null
  colorBuffer: WebGLBuffer | null
  isInitialized: boolean
}

interface SpectrogramSettings {
  frequencyBands: number
  timeSegments: number
  heightScale: number
  colorScheme: 'rainbow' | 'plasma' | 'viridis' | 'heat'
  rotationSpeed: number
  perspective: number
  smoothing: number
}

export function Spectrogram3D({ analysis, fileName, audioData, className }: Spectrogram3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const webglRef = useRef<WebGLState>({
    gl: null,
    program: null,
    vertexBuffer: null,
    indexBuffer: null,
    colorBuffer: null,
    isInitialized: false
  })

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  const [settings, setSettings] = useState<SpectrogramSettings>({
    frequencyBands: 64,
    timeSegments: 128,
    heightScale: 2.0,
    colorScheme: 'rainbow',
    rotationSpeed: 0.5,
    perspective: 45,
    smoothing: 0.8
  })

  // Shader sources
  const vertexShaderSource = `
    attribute vec3 a_position;
    attribute vec3 a_color;
    
    uniform mat4 u_projection;
    uniform mat4 u_modelView;
    uniform float u_time;
    uniform float u_heightScale;
    
    varying vec3 v_color;
    varying float v_height;
    
    void main() {
      vec3 position = a_position;
      
      // Apply height scaling
      position.y *= u_heightScale;
      
      // Add subtle wave animation
      position.y += sin(position.x * 0.1 + u_time) * 0.1;
      
      gl_Position = u_projection * u_modelView * vec4(position, 1.0);
      v_color = a_color;
      v_height = position.y;
    }
  `

  const fragmentShaderSource = `
    precision mediump float;
    
    varying vec3 v_color;
    varying float v_height;
    
    uniform float u_time;
    
    void main() {
      vec3 color = v_color;
      
      // Add glow effect based on height
      float glow = smoothstep(0.0, 1.0, v_height);
      color += vec3(glow * 0.3);
      
      // Add time-based shimmer
      float shimmer = sin(u_time * 2.0) * 0.1 + 0.9;
      color *= shimmer;
      
      gl_FragColor = vec4(color, 0.9);
    }
  `

  // Initialize WebGL
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return false

    const gl = canvas.getContext('webgl', {
      alpha: true,
      depth: true,
      antialias: true,
      premultipliedAlpha: false
    })

    if (!gl) {
      console.error('WebGL not supported')
      return false
    }

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

    if (!vertexShader || !fragmentShader) {
      console.error('Failed to create shaders')
      return false
    }

    // Create program
    const program = createProgram(gl, vertexShader, fragmentShader)
    if (!program) {
      console.error('Failed to create WebGL program')
      return false
    }

    // Enable depth testing and blending
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    webglRef.current = {
      gl,
      program,
      vertexBuffer: null,
      indexBuffer: null,
      colorBuffer: null,
      isInitialized: true
    }

    return true
  }, [])

  // Create shader helper
  const createShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type)
    if (!shader) return null

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }

    return shader
  }

  // Create program helper
  const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null => {
    const program = gl.createProgram()
    if (!program) return null

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }

    return program
  }

  // Generate spectrogram data
  const generateSpectrogramData = useCallback(() => {
    const { frequencyBands, timeSegments } = settings
    const vertices: number[] = []
    const indices: number[] = []
    const colors: number[] = []

    // Generate real or simulated spectrogram data
    const spectrogramData = audioData ? 
      generateRealSpectrogramData(audioData, frequencyBands, timeSegments) :
      generateSimulatedSpectrogramData(analysis, frequencyBands, timeSegments)

    // Create 3D mesh
    for (let t = 0; t < timeSegments; t++) {
      for (let f = 0; f < frequencyBands; f++) {
        const x = (t / (timeSegments - 1)) * 4 - 2  // Map to [-2, 2]
        const z = (f / (frequencyBands - 1)) * 4 - 2  // Map to [-2, 2]
        const y = spectrogramData[t * frequencyBands + f] * 2  // Height based on magnitude

        vertices.push(x, y, z)

        // Generate colors based on frequency and magnitude
        const color = getSpectrogramColor(f / frequencyBands, y / 2, settings.colorScheme)
        colors.push(color.r, color.g, color.b)

        // Generate indices for triangles (except for last row/column)
        if (t < timeSegments - 1 && f < frequencyBands - 1) {
          const current = t * frequencyBands + f
          const next = (t + 1) * frequencyBands + f
          const belowCurrent = t * frequencyBands + (f + 1)
          const belowNext = (t + 1) * frequencyBands + (f + 1)

          // Two triangles per quad
          indices.push(current, next, belowCurrent)
          indices.push(next, belowNext, belowCurrent)
        }
      }
    }

    return { vertices, indices, colors }
  }, [audioData, analysis, settings])

  // Generate real spectrogram data from audio
  const generateRealSpectrogramData = (audioData: Float32Array, frequencyBands: number, timeSegments: number): number[] => {
    const data: number[] = []
    const fftSize = 2048
    const hopSize = Math.floor(audioData.length / timeSegments)

    for (let t = 0; t < timeSegments; t++) {
      const startSample = t * hopSize
      const windowData = audioData.slice(startSample, startSample + fftSize)
      
      // Apply Hann window
      for (let i = 0; i < windowData.length; i++) {
        windowData[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowData.length - 1)))
      }

      // Perform FFT (simplified - in real implementation use a proper FFT library)
      const spectrum = performSimpleFFT(windowData, frequencyBands)
      data.push(...spectrum)
    }

    return data
  }

  // Simplified FFT for demonstration
  const performSimpleFFT = (signal: Float32Array, bands: number): number[] => {
    const spectrum: number[] = []
    const N = signal.length

    for (let k = 0; k < bands; k++) {
      let real = 0
      let imag = 0

      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N
        real += signal[n] * Math.cos(angle)
        imag += signal[n] * Math.sin(angle)
      }

      const magnitude = Math.sqrt(real * real + imag * imag) / N
      spectrum.push(Math.log(magnitude + 1e-10) + 10) // Convert to dB-like scale
    }

    // Normalize
    const max = Math.max(...spectrum)
    return spectrum.map(val => Math.max(0, val / max))
  }

  // Generate simulated spectrogram data
  const generateSimulatedSpectrogramData = (analysis: AudioAnalysis, frequencyBands: number, timeSegments: number): number[] => {
    const data: number[] = []
    const baseLevel = Math.abs(analysis.rmsLevel) / 60  // Normalize RMS to 0-1
    
    for (let t = 0; t < timeSegments; t++) {
      for (let f = 0; f < frequencyBands; f++) {
        // Simulate frequency content based on analysis
        const freq = (f / frequencyBands) * 22050  // Nyquist frequency
        const time = (t / timeSegments) * analysis.duration

        let magnitude = baseLevel
        
        // Simulate typical music spectrum (more energy in lower frequencies)
        magnitude *= Math.exp(-freq / 5000) * (0.5 + 0.5 * Math.random())
        
        // Add some temporal variation
        magnitude *= (0.8 + 0.4 * Math.sin(time * 0.5) * Math.sin(freq * 0.001))
        
        // Simulate some formants for voice-like content
        if (freq > 80 && freq < 3000) {
          magnitude *= 1.2 + 0.3 * Math.sin(freq / 400)
        }

        data.push(Math.max(0, Math.min(1, magnitude)))
      }
    }

    return data
  }

  // Get color based on frequency and magnitude
  const getSpectrogramColor = (frequency: number, magnitude: number, scheme: string) => {
    switch (scheme) {
      case 'rainbow':
        return {
          r: Math.sin(frequency * Math.PI) * magnitude,
          g: Math.sin((frequency + 0.33) * Math.PI) * magnitude,
          b: Math.sin((frequency + 0.66) * Math.PI) * magnitude
        }
      case 'plasma':
        return {
          r: Math.pow(magnitude, 0.8),
          g: Math.pow(magnitude, 1.2) * frequency,
          b: Math.pow(magnitude, 2.0) * (1 - frequency)
        }
      case 'viridis':
        return {
          r: magnitude * (0.267 + 0.529 * frequency),
          g: magnitude * (0.004 + 0.718 * frequency),
          b: magnitude * (0.329 - 0.137 * frequency)
        }
      case 'heat':
        return {
          r: magnitude,
          g: magnitude * Math.max(0, 2 * magnitude - 1),
          b: magnitude * Math.max(0, 3 * magnitude - 2)
        }
      default:
        return { r: magnitude, g: magnitude, b: magnitude }
    }
  }

  // Render 3D spectrogram
  const render = useCallback((time: number) => {
    const { gl, program } = webglRef.current
    if (!gl || !program) return

    // Clear canvas
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clearColor(0.05, 0.05, 0.15, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    gl.useProgram(program)

    // Generate and upload data
    const { vertices, indices, colors } = generateSpectrogramData()

    // Create/update buffers
    if (!webglRef.current.vertexBuffer) {
      webglRef.current.vertexBuffer = gl.createBuffer()
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, webglRef.current.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW)

    if (!webglRef.current.colorBuffer) {
      webglRef.current.colorBuffer = gl.createBuffer()
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, webglRef.current.colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW)

    if (!webglRef.current.indexBuffer) {
      webglRef.current.indexBuffer = gl.createBuffer()
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, webglRef.current.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)

    // Set up attributes
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const colorLocation = gl.getAttribLocation(program, 'a_color')

    gl.bindBuffer(gl.ARRAY_BUFFER, webglRef.current.vertexBuffer)
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, webglRef.current.colorBuffer)
    gl.enableVertexAttribArray(colorLocation)
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0)

    // Set up uniforms
    const projectionLocation = gl.getUniformLocation(program, 'u_projection')
    const modelViewLocation = gl.getUniformLocation(program, 'u_modelView')
    const timeLocation = gl.getUniformLocation(program, 'u_time')
    const heightScaleLocation = gl.getUniformLocation(program, 'u_heightScale')

    // Create projection matrix
    const aspect = gl.canvas.width / gl.canvas.height
    const projection = createPerspectiveMatrix(settings.perspective * Math.PI / 180, aspect, 0.1, 100.0)

    // Create model-view matrix with rotation
    const rotation = isPlaying ? time * settings.rotationSpeed * 0.001 : currentTime * 0.01
    const modelView = createModelViewMatrix(rotation)

    gl.uniformMatrix4fv(projectionLocation, false, projection)
    gl.uniformMatrix4fv(modelViewLocation, false, modelView)
    gl.uniform1f(timeLocation, time * 0.001)
    gl.uniform1f(heightScaleLocation, settings.heightScale)

    // Draw
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0)
  }, [settings, isPlaying, currentTime, generateSpectrogramData])

  // Matrix math helpers
  const createPerspectiveMatrix = (fov: number, aspect: number, near: number, far: number): Float32Array => {
    const f = 1.0 / Math.tan(fov / 2)
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), (2 * far * near) / (near - far),
      0, 0, -1, 0
    ])
  }

  const createModelViewMatrix = (rotation: number): Float32Array => {
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    return new Float32Array([
      cos, 0, sin, 0,
      0, 1, 0, 0,
      -sin, 0, cos, 0,
      0, -1, -8, 1  // Translate back and down
    ])
  }

  // Animation loop
  useEffect(() => {
    if (!webglRef.current.isInitialized) return

    const animate = (time: number) => {
      if (isPlaying) {
        setCurrentTime(time)
      }
      render(time)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, render])

  // Initialize WebGL on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    if (initWebGL()) {
      render(0)
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [initWebGL, render])

  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
  }

  const resetView = () => {
    setCurrentTime(0)
    setIsPlaying(false)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const updateSetting = (key: keyof SpectrogramSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <Card className={`spectrogram-3d ${className} ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-purple-800" />
            Spettrografica 3D - {fileName}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              WebGL
            </Badge>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={resetView}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Volume2 className="h-4 w-4" />
            <span>{settings.frequencyBands} bands × {settings.timeSegments} segments</span>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Frequency Bands</label>
                <Slider
                  value={[settings.frequencyBands]}
                  onValueChange={([value]) => updateSetting('frequencyBands', value)}
                  min={32}
                  max={128}
                  step={16}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{settings.frequencyBands}</span>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Time Segments</label>
                <Slider
                  value={[settings.timeSegments]}
                  onValueChange={([value]) => updateSetting('timeSegments', value)}
                  min={64}
                  max={256}
                  step={32}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{settings.timeSegments}</span>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Height Scale</label>
                <Slider
                  value={[settings.heightScale]}
                  onValueChange={([value]) => updateSetting('heightScale', value)}
                  min={0.5}
                  max={5.0}
                  step={0.1}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{settings.heightScale.toFixed(1)}</span>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Rotation Speed</label>
                <Slider
                  value={[settings.rotationSpeed]}
                  onValueChange={([value]) => updateSetting('rotationSpeed', value)}
                  min={0}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{settings.rotationSpeed.toFixed(1)}</span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Color Scheme</label>
              <div className="flex gap-2">
                {(['rainbow', 'plasma', 'viridis', 'heat'] as const).map((scheme) => (
                  <Button
                    key={scheme}
                    variant={settings.colorScheme === scheme ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateSetting('colorScheme', scheme)}
                    className="capitalize"
                  >
                    {scheme}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3D Canvas */}
        <div className={`relative ${isFullscreen ? 'h-full' : 'h-96'} bg-gradient-to-br from-gray-900 to-black rounded-lg overflow-hidden`}>
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: 'block' }}
          />
          
          {!webglRef.current.isInitialized && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
              <div className="text-center text-white">
                <Zap className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                <p>Initializing WebGL...</p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p>
            Spettrografica 3D con accelerazione WebGL. Visualizza frequenze nel tempo con rappresentazione tridimensionale.
            {audioData ? ' Basata su dati audio reali.' : ' Simulazione basata su analisi audio.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}