import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { AudioAnalysis } from '@/types/audio'
import { gpuRenderer } from '@/lib/gpu-renderer'
import { 
  Radio, 
  Settings, 
  Maximize2, 
  RotateCcw,
  Activity,
  Zap,
  Target
} from 'lucide-react'

interface VectorScopeProps {
  analysis: AudioAnalysis
  fileName: string
  leftChannel?: Float32Array
  rightChannel?: Float32Array
  className?: string
}

interface VectorScopeSettings {
  size: number
  persistence: number
  gain: number
  colorScheme: 'classic' | 'neon' | 'plasma' | 'rainbow'
  showGrid: boolean
  showPhaseLines: boolean
  antialiasing: boolean
  frameRate: number
}

interface StereoMetrics {
  correlation: number
  stereoWidth: number
  monoCompatibility: number
  phaseCoherence: number
  lissajousShape: 'line' | 'ellipse' | 'circle' | 'complex'
}

export function VectorScope({ analysis, fileName, leftChannel, rightChannel, className }: VectorScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const frameBufferRef = useRef<ImageData | null>(null)
  
  const [settings, setSettings] = useState<VectorScopeSettings>({
    size: 512,
    persistence: 0.8,
    gain: 1.0,
    colorScheme: 'neon',
    showGrid: true,
    showPhaseLines: true,
    antialiasing: true,
    frameRate: 30
  })
  
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [stereoMetrics, setStereoMetrics] = useState<StereoMetrics | null>(null)
  const [currentFrame, setCurrentFrame] = useState(0)

  // Generate or simulate stereo data
  const getStereoData = useCallback(() => {
    if (leftChannel && rightChannel) {
      return { left: leftChannel, right: rightChannel }
    } else {
      // Generate simulated stereo data based on analysis
      return generateSimulatedStereoData(analysis)
    }
  }, [leftChannel, rightChannel, analysis])

  const generateSimulatedStereoData = (analysis: AudioAnalysis): { left: Float32Array, right: Float32Array } => {
    const length = 44100 // 1 second at 44.1kHz
    const left = new Float32Array(length)
    const right = new Float32Array(length)
    
    const baseLevel = Math.abs(analysis.rmsLevel) / 60
    const stereoWidth = analysis.channels === 2 ? 0.8 : 0.1
    
    for (let i = 0; i < length; i++) {
      const t = i / 44100
      
      // Generate base signal (music-like)
      let signal = 0
      signal += Math.sin(t * 2 * Math.PI * 440) * 0.3 // A4 fundamental
      signal += Math.sin(t * 2 * Math.PI * 880) * 0.2 // Harmonic
      signal += Math.sin(t * 2 * Math.PI * 220) * 0.15 // Sub-harmonic
      signal += (Math.random() - 0.5) * 0.1 // Noise
      
      // Apply stereo width
      const stereoOffset = Math.sin(t * 2 * Math.PI * 2) * stereoWidth
      
      left[i] = signal * baseLevel * (1 + stereoOffset)
      right[i] = signal * baseLevel * (1 - stereoOffset)
      
      // Add some phase correlation variations
      const phaseShift = Math.sin(t * 2 * Math.PI * 0.5) * 0.3
      right[i] += Math.sin((t + phaseShift) * 2 * Math.PI * 440) * baseLevel * 0.2
    }
    
    return { left, right }
  }

  const calculateStereoMetrics = (left: Float32Array, right: Float32Array): StereoMetrics => {
    const length = Math.min(left.length, right.length, 8192) // Use subset for performance
    
    // Calculate correlation coefficient
    let correlation = 0
    let leftSum = 0, rightSum = 0, leftSqSum = 0, rightSqSum = 0, crossSum = 0
    
    for (let i = 0; i < length; i++) {
      leftSum += left[i]
      rightSum += right[i]
      leftSqSum += left[i] * left[i]
      rightSqSum += right[i] * right[i]
      crossSum += left[i] * right[i]
    }
    
    const leftMean = leftSum / length
    const rightMean = rightSum / length
    const leftVar = leftSqSum / length - leftMean * leftMean
    const rightVar = rightSqSum / length - rightMean * rightMean
    
    if (leftVar > 0 && rightVar > 0) {
      correlation = (crossSum / length - leftMean * rightMean) / Math.sqrt(leftVar * rightVar)
    }
    
    // Calculate stereo width (difference signal strength)
    let widthSum = 0
    for (let i = 0; i < length; i++) {
      const diff = left[i] - right[i]
      widthSum += diff * diff
    }
    const stereoWidth = Math.sqrt(widthSum / length)
    
    // Mono compatibility (sum signal strength)
    let monoSum = 0
    for (let i = 0; i < length; i++) {
      const sum = (left[i] + right[i]) / 2
      monoSum += sum * sum
    }
    const monoCompatibility = Math.sqrt(monoSum / length)
    
    // Phase coherence (simplified)
    const phaseCoherence = Math.abs(correlation)
    
    // Determine Lissajous shape
    let lissajousShape: StereoMetrics['lissajousShape'] = 'complex'
    if (Math.abs(correlation) > 0.9) {
      lissajousShape = 'line'
    } else if (Math.abs(correlation) < 0.1) {
      lissajousShape = 'circle'
    } else {
      lissajousShape = 'ellipse'
    }
    
    return {
      correlation: Math.max(-1, Math.min(1, correlation)),
      stereoWidth,
      monoCompatibility,
      phaseCoherence,
      lissajousShape
    }
  }

  const renderVectorScope = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    const { width, height } = canvas
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 20

    const stereoData = getStereoData()
    const metrics = calculateStereoMetrics(stereoData.left, stereoData.right)
    setStereoMetrics(metrics)

    // Apply persistence by dimming previous frame
    if (settings.persistence > 0 && frameBufferRef.current) {
      const imageData = frameBufferRef.current
      const data = imageData.data
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.floor(data[i] * settings.persistence)     // R
        data[i + 1] = Math.floor(data[i + 1] * settings.persistence) // G
        data[i + 2] = Math.floor(data[i + 2] * settings.persistence) // B
        // Alpha stays the same
      }
      
      ctx.putImageData(imageData, 0, 0)
    } else {
      // Clear canvas
      ctx.fillStyle = 'rgba(5, 5, 15, 1)'
      ctx.fillRect(0, 0, width, height)
    }

    // Draw grid and phase lines
    if (settings.showGrid) {
      drawGrid(ctx, centerX, centerY, radius)
    }

    if (settings.showPhaseLines) {
      drawPhaseLines(ctx, centerX, centerY, radius)
    }

    // Draw vector scope points
    drawVectorPoints(ctx, centerX, centerY, radius, stereoData, metrics)

    // Store current frame for persistence
    frameBufferRef.current = ctx.getImageData(0, 0, width, height)
    
    setCurrentFrame(prev => prev + 1)
  }, [getStereoData, settings])

  const drawGrid = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    // Circular grid
    for (let i = 1; i <= 4; i++) {
      const r = (radius * i) / 4
      ctx.beginPath()
      ctx.arc(centerX, centerY, r, 0, 2 * Math.PI)
      ctx.stroke()
    }

    // Cross lines
    ctx.beginPath()
    ctx.moveTo(centerX - radius, centerY)
    ctx.lineTo(centerX + radius, centerY)
    ctx.moveTo(centerX, centerY - radius)
    ctx.lineTo(centerX, centerY + radius)
    ctx.stroke()
  }

  const drawPhaseLines = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) => {
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)'
    ctx.lineWidth = 1

    // 45-degree lines (mono signals)
    ctx.beginPath()
    ctx.moveTo(centerX - radius * 0.707, centerY - radius * 0.707)
    ctx.lineTo(centerX + radius * 0.707, centerY + radius * 0.707)
    ctx.moveTo(centerX - radius * 0.707, centerY + radius * 0.707)
    ctx.lineTo(centerX + radius * 0.707, centerY - radius * 0.707)
    ctx.stroke()

    // Labels
    ctx.fillStyle = 'rgba(200, 200, 255, 0.6)'
    ctx.font = '10px sans-serif'
    ctx.fillText('L', centerX - radius - 15, centerY + 3)
    ctx.fillText('R', centerX + radius + 8, centerY + 3)
    ctx.fillText('L+R', centerX - 15, centerY - radius - 8)
    ctx.fillText('L-R', centerX - 15, centerY + radius + 15)
  }

  const drawVectorPoints = (
    ctx: CanvasRenderingContext2D, 
    centerX: number, 
    centerY: number, 
    radius: number, 
    stereoData: { left: Float32Array, right: Float32Array },
    metrics: StereoMetrics
  ) => {
    const { left, right } = stereoData
    const pointsToRender = Math.min(left.length, right.length, 2048) // Limit for performance
    const step = Math.max(1, Math.floor(left.length / pointsToRender))

    // Set up rendering based on color scheme
    const baseAlpha = 0.7
    let pointSize = 1

    if (settings.antialiasing) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
    }

    for (let i = 0; i < pointsToRender; i++) {
      const index = i * step
      if (index >= left.length || index >= right.length) break

      const leftSample = left[index] * settings.gain
      const rightSample = right[index] * settings.gain

      // Map to screen coordinates
      const x = centerX + leftSample * radius
      const y = centerY - rightSample * radius // Invert Y for screen coordinates

      // Skip points outside the circle
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
      if (distance > radius) continue

      // Color based on position and intensity
      const intensity = Math.sqrt(leftSample ** 2 + rightSample ** 2)
      const color = getPointColor(leftSample, rightSample, intensity, settings.colorScheme)

      ctx.fillStyle = color
      ctx.fillRect(x - pointSize/2, y - pointSize/2, pointSize, pointSize)

      // Add glow effect for neon scheme
      if (settings.colorScheme === 'neon' && intensity > 0.5) {
        ctx.shadowColor = color
        ctx.shadowBlur = 2
        ctx.fillRect(x - pointSize/2, y - pointSize/2, pointSize, pointSize)
        ctx.shadowBlur = 0
      }
    }
  }

  const getPointColor = (left: number, right: number, intensity: number, scheme: string): string => {
    const alpha = Math.min(1, intensity * 2 + 0.3)
    
    switch (scheme) {
      case 'classic':
        return `rgba(0, 255, 0, ${alpha})`
      
      case 'neon':
        const neonIntensity = Math.min(1, intensity * 3)
        return `rgba(0, ${Math.floor(255 * neonIntensity)}, 255, ${alpha})`
      
      case 'plasma':
        const angle = Math.atan2(right, left) + Math.PI
        const plasmaHue = (angle / (2 * Math.PI)) * 360
        return `hsla(${plasmaHue}, 100%, ${50 + intensity * 50}%, ${alpha})`
      
      case 'rainbow':
        const correlation = (left + right) / 2
        const rainbowHue = ((correlation + 1) / 2) * 240 // Map -1,1 to 0,240 (blue to red)
        return `hsla(${rainbowHue}, 80%, ${60 + intensity * 30}%, ${alpha})`
      
      default:
        return `rgba(0, 255, 255, ${alpha})`
    }
  }

  // Animation loop
  useEffect(() => {
    if (!isRunning) return

    const animate = () => {
      renderVectorScope()
      
      setTimeout(() => {
        if (isRunning) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }, 1000 / settings.frameRate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isRunning, renderVectorScope, settings.frameRate])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const size = settings.size
      canvas.width = size
      canvas.height = size
    }

    resizeCanvas()
    renderVectorScope() // Initial render
  }, [settings.size, renderVectorScope])

  const updateSetting = (key: keyof VectorScopeSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const togglePlayback = () => {
    setIsRunning(!isRunning)
  }

  const reset = () => {
    setIsRunning(false)
    frameBufferRef.current = null
    setCurrentFrame(0)
    renderVectorScope()
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <Card className={`vector-scope ${className} ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Radio className="h-4 w-4 text-[color:var(--primary-ink)]" />
            Vector Scope - {fileName}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-[color:var(--tint-primary)] text-[color:var(--primary-ink)]">
              {settings.size}x{settings.size}
            </Badge>
            
            {isRunning && (
              <Badge variant="secondary" className="bg-[color:var(--tint-success)] text-[color:var(--success)]">
                <Activity className="h-3 w-3 mr-1 animate-pulse" />
                Live
              </Badge>
            )}
            
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="h-4 w-4" />
            </Button>
            
            <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
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
              variant={isRunning ? 'default' : 'outline'}
              size="sm"
              onClick={togglePlayback}
            >
              {isRunning ? 'Stop' : 'Start'}
            </Button>
            
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>Frame: {currentFrame}</span>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-4 p-4 bg-muted rounded-lg space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Persistence</label>
                <Slider
                  value={[settings.persistence]}
                  onValueChange={([value]) => updateSetting('persistence', value)}
                  min={0}
                  max={0.99}
                  step={0.01}
                  className="w-full"
                />
                <span className="text-xs text-muted-foreground">{settings.persistence.toFixed(2)}</span>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Gain</label>
                <Slider
                  value={[settings.gain]}
                  onValueChange={([value]) => updateSetting('gain', value)}
                  min={0.1}
                  max={5.0}
                  step={0.1}
                  className="w-full"
                />
                <span className="text-xs text-muted-foreground">{settings.gain.toFixed(1)}x</span>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Frame Rate</label>
                <Slider
                  value={[settings.frameRate]}
                  onValueChange={([value]) => updateSetting('frameRate', value)}
                  min={10}
                  max={60}
                  step={5}
                  className="w-full"
                />
                <span className="text-xs text-muted-foreground">{settings.frameRate} fps</span>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Size</label>
                <Slider
                  value={[settings.size]}
                  onValueChange={([value]) => updateSetting('size', value)}
                  min={256}
                  max={1024}
                  step={128}
                  className="w-full"
                />
                <span className="text-xs text-muted-foreground">{settings.size}px</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant={settings.showGrid ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSetting('showGrid', !settings.showGrid)}
              >
                Grid
              </Button>
              
              <Button
                variant={settings.showPhaseLines ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSetting('showPhaseLines', !settings.showPhaseLines)}
              >
                Phase Lines
              </Button>
              
              <Button
                variant={settings.antialiasing ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSetting('antialiasing', !settings.antialiasing)}
              >
                Antialiasing
              </Button>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Color Scheme</label>
              <div className="flex gap-2">
                {(['classic', 'neon', 'plasma', 'rainbow'] as const).map((scheme) => (
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

        {/* Vector Scope Display */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '1' }}>
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair"
                style={{ display: 'block', imageRendering: settings.antialiasing ? 'auto' : 'pixelated' }}
              />
            </div>
          </div>
          
          {/* Stereo Metrics */}
          {stereoMetrics && (
            <div className="lg:w-48 space-y-3">
              <h4 className="font-medium text-foreground">Stereo Analysis</h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Correlation:</span>
                  <span className={`font-mono ${stereoMetrics.correlation > 0.7 ? 'text-[color:var(--success)]' : stereoMetrics.correlation < -0.3 ? 'text-[color:var(--danger)]' : 'text-[color:var(--warning)]'}`}>
                    {stereoMetrics.correlation.toFixed(3)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Width:</span>
                  <span className="font-mono">{stereoMetrics.stereoWidth.toFixed(3)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mono Compat:</span>
                  <span className="font-mono">{stereoMetrics.monoCompatibility.toFixed(3)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coherence:</span>
                  <span className="font-mono">{stereoMetrics.phaseCoherence.toFixed(3)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pattern:</span>
                  <span className="capitalize text-[color:var(--primary-ink)]">{stereoMetrics.lissajousShape}</span>
                </div>
              </div>
              
              <div className="p-2 bg-[color:var(--tint-info)] rounded text-xs text-[color:var(--info)]">
                <p className="mb-1"><strong>Interpretazione:</strong></p>
                <p>
                  {stereoMetrics.correlation > 0.8 ? 'Segnale principalmente mono' :
                   stereoMetrics.correlation > 0.5 ? 'Buona stereo con correlazione' :
                   stereoMetrics.correlation > 0 ? 'Ampio stereo field' :
                   'Possibili problemi di fase'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            Vector Scope mostra la relazione fase-ampiezza tra canali L/R. 
            {leftChannel && rightChannel ? ' Basato su dati audio reali.' : ' Simulazione basata su analisi.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}