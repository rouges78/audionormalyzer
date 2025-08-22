import React, { useRef, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AudioAnalysis } from '@/types/audio'
import { BarChart3, Maximize2, Minimize2 } from 'lucide-react'

interface WaveformDisplayProps {
  analysis: AudioAnalysis
  fileName: string
  audioData?: Float32Array
  className?: string
}

export function WaveformDisplay({ analysis, fileName, audioData, className }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 800, height: 200 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    
    ctx.scale(dpr, dpr)
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'

    drawWaveform(ctx, rect.width, rect.height)
  }, [audioData, analysis, dimensions])

  const drawWaveform = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Clear canvas
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, width, height)

    // If we have real audio data, use it; otherwise simulate based on analysis
    const samples = audioData || generateSimulatedWaveform(analysis, width)
    
    if (samples.length === 0) return

    // Draw waveform
    ctx.strokeStyle = '#7c3aed'
    ctx.lineWidth = 1
    ctx.beginPath()

    const centerY = height / 2
    const amplitude = height * 0.4

    for (let i = 0; i < samples.length; i++) {
      const x = (i / samples.length) * width
      const y = centerY + (samples[i] * amplitude)
      
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    
    ctx.stroke()

    // Draw peak level indicators
    drawPeakIndicators(ctx, width, height, analysis)
    
    // Draw loudness range
    drawLoudnessRange(ctx, width, height, analysis)
  }

  const generateSimulatedWaveform = (analysis: AudioAnalysis, width: number): Float32Array => {
    const samples = new Float32Array(width)
    const peakLevel = Math.pow(10, analysis.peakLevel / 20) // Convert dB to linear
    const rmsLevel = Math.pow(10, analysis.rmsLevel / 20)
    
    for (let i = 0; i < width; i++) {
      // Create a more realistic waveform based on analysis data
      const t = i / width
      const baseWave = Math.sin(t * Math.PI * 20) * 0.3
      const envelope = Math.sin(t * Math.PI) * 0.7
      const noise = (Math.random() - 0.5) * 0.1
      
      // Scale by RMS level with occasional peaks
      let sample = (baseWave + noise) * rmsLevel * envelope
      
      // Add occasional peaks near the peak level
      if (Math.random() < 0.02) {
        sample = sample > 0 ? peakLevel * 0.9 : -peakLevel * 0.9
      }
      
      samples[i] = Math.max(-1, Math.min(1, sample))
    }
    
    return samples
  }

  const drawPeakIndicators = (ctx: CanvasRenderingContext2D, width: number, height: number, analysis: AudioAnalysis) => {
    const centerY = height / 2
    const peakLevel = Math.pow(10, analysis.peakLevel / 20)
    const peakY = centerY - (peakLevel * height * 0.4)
    const negPeakY = centerY + (peakLevel * height * 0.4)

    // Draw peak level lines
    ctx.strokeStyle = analysis.peakLevel > -1 ? '#ef4444' : '#f59e0b'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    
    ctx.beginPath()
    ctx.moveTo(0, peakY)
    ctx.lineTo(width, peakY)
    ctx.moveTo(0, negPeakY)
    ctx.lineTo(width, negPeakY)
    ctx.stroke()
    
    ctx.setLineDash([])

    // Peak level labels
    ctx.fillStyle = analysis.peakLevel > -1 ? '#ef4444' : '#f59e0b'
    ctx.font = '12px sans-serif'
    ctx.fillText(`Peak: ${analysis.peakLevel.toFixed(1)} dB`, 10, peakY - 5)
  }

  const drawLoudnessRange = (ctx: CanvasRenderingContext2D, width: number, height: number, analysis: AudioAnalysis) => {
    const centerY = height / 2
    const rmsLevel = Math.pow(10, analysis.rmsLevel / 20)
    const rmsY = centerY - (rmsLevel * height * 0.4)
    const negRmsY = centerY + (rmsLevel * height * 0.4)

    // Draw RMS level area
    ctx.fillStyle = 'rgba(124, 58, 237, 0.1)'
    ctx.fillRect(0, rmsY, width, negRmsY - rmsY)

    // RMS level line
    ctx.strokeStyle = '#7c3aed'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    
    ctx.beginPath()
    ctx.moveTo(0, rmsY)
    ctx.lineTo(width, rmsY)
    ctx.moveTo(0, negRmsY)
    ctx.lineTo(width, negRmsY)
    ctx.stroke()
    
    ctx.setLineDash([])

    // RMS level label
    ctx.fillStyle = '#7c3aed'
    ctx.font = '12px sans-serif'
    ctx.fillText(`RMS: ${analysis.rmsLevel.toFixed(1)} dB`, 10, height - 15)
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
    setDimensions(prev => ({
      width: prev.width,
      height: isExpanded ? 200 : 400
    }))
  }

  return (
    <Card className={`audio-card ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-purple-800" />
            Waveform - {fileName}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleExpanded}
            className="p-2"
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Canvas Waveform */}
          <div className="relative bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: `${dimensions.height}px` }}
            />
          </div>

          {/* Waveform Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <div className="font-medium text-gray-900 dark:text-white">
                {analysis.peakLevel.toFixed(1)} dB
              </div>
              <div className="text-gray-500 dark:text-gray-400">Peak</div>
            </div>
            
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <div className="font-medium text-gray-900 dark:text-white">
                {analysis.rmsLevel.toFixed(1)} dB
              </div>
              <div className="text-gray-500 dark:text-gray-400">RMS</div>
            </div>
            
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <div className="font-medium text-gray-900 dark:text-white">
                {analysis.lufsIntegrated.toFixed(1)} LUFS
              </div>
              <div className="text-gray-500 dark:text-gray-400">Loudness</div>
            </div>
            
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <div className="font-medium text-gray-900 dark:text-white">
                {Math.abs(analysis.peakLevel - analysis.rmsLevel).toFixed(1)} dB
              </div>
              <div className="text-gray-500 dark:text-gray-400">Dynamic Range</div>
            </div>
          </div>

          {/* Clipping Warning */}
          {analysis.hasClipping && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <BarChart3 className="h-4 w-4" />
                <span className="font-medium">Clipping Rilevato</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                Il segnale audio supera 0 dB, causando distorsione. Si consiglia la normalizzazione.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}