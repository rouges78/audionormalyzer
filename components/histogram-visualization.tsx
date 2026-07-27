import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AudioAnalysis } from '@/types/audio'
import { BarChart3, Settings, Activity } from 'lucide-react'

interface HistogramProps {
  analysis: AudioAnalysis
  fileName: string
  audioData?: Float32Array
  className?: string
}

export function HistogramVisualization({ analysis, fileName, audioData, className }: HistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [settings, setSettings] = useState({
    bins: 256,
    logarithmic: false,
    colorScheme: 'gradient' as 'classic' | 'heatmap' | 'gradient' | 'neon',
    showStatistics: true
  })
  const [activeTab, setActiveTab] = useState<'amplitude' | 'rms' | 'spectral' | 'loudness'>('amplitude')
  const [histogramData, setHistogramData] = useState<any>(null)

  const generateHistogramData = useCallback(() => {
    if (audioData) {
      // Real data processing
      const amplitudeHist = calculateHistogram(audioData, settings.bins, [-1, 1])
      const rmsData = calculateRMSWindows(audioData, 1024)
      const rmsHist = calculateHistogram(rmsData, settings.bins, [0, Math.max(...rmsData)])
      
      setHistogramData({
        amplitude: amplitudeHist,
        rms: rmsHist,
        spectral: generateSimulatedData(settings.bins),
        loudness: generateSimulatedData(settings.bins)
      })
    } else {
      // Simulated data
      setHistogramData({
        amplitude: generateGaussianHistogram(settings.bins, 0, 0.3),
        rms: generateExponentialHistogram(settings.bins, 2),
        spectral: generatePowerLawHistogram(settings.bins, -1.5),
        loudness: generateGaussianHistogram(settings.bins, analysis.lufsIntegrated, 3)
      })
    }
  }, [audioData, analysis, settings.bins])

  const calculateHistogram = (data: Float32Array, bins: number, range: [number, number]) => {
    const [min, max] = range
    const binWidth = (max - min) / bins
    const binCounts = new Array(bins).fill(0)

    for (let i = 0; i < data.length; i++) {
      const value = data[i]
      if (value >= min && value <= max) {
        const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1)
        binCounts[binIndex]++
      }
    }

    const total = binCounts.reduce((sum, count) => sum + count, 0)
    return { bins: binCounts.map(count => count / total) }
  }

  const calculateRMSWindows = (audioData: Float32Array, windowSize: number): Float32Array => {
    const hopSize = windowSize / 2
    const numWindows = Math.floor((audioData.length - windowSize) / hopSize) + 1
    const rmsValues = new Float32Array(numWindows)

    for (let i = 0; i < numWindows; i++) {
      const start = i * hopSize
      let sum = 0
      for (let j = 0; j < windowSize && start + j < audioData.length; j++) {
        const sample = audioData[start + j]
        sum += sample * sample
      }
      rmsValues[i] = Math.sqrt(sum / windowSize)
    }
    return rmsValues
  }

  const generateGaussianHistogram = (bins: number, mean: number, std: number) => {
    const binCounts = new Array(bins).fill(0)
    for (let i = 0; i < bins; i++) {
      const x = (i / bins) * 4 - 2 // Map to [-2, 2]
      const value = Math.exp(-0.5 * Math.pow((x - mean) / std, 2))
      binCounts[i] = value
    }
    const total = binCounts.reduce((sum, val) => sum + val, 0)
    return { bins: binCounts.map(val => val / total) }
  }

  const generateExponentialHistogram = (bins: number, lambda: number) => {
    const binCounts = new Array(bins).fill(0)
    for (let i = 0; i < bins; i++) {
      const x = i / bins
      binCounts[i] = lambda * Math.exp(-lambda * x)
    }
    const total = binCounts.reduce((sum, val) => sum + val, 0)
    return { bins: binCounts.map(val => val / total) }
  }

  const generatePowerLawHistogram = (bins: number, alpha: number) => {
    const binCounts = new Array(bins).fill(0)
    for (let i = 1; i < bins; i++) {
      const x = i / bins
      binCounts[i] = Math.pow(x, alpha)
    }
    const total = binCounts.reduce((sum, val) => sum + val, 0)
    return { bins: binCounts.map(val => val / total) }
  }

  const generateSimulatedData = (bins: number) => {
    return { bins: Array.from({ length: bins }, () => Math.random()) }
  }

  const renderHistogram = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !histogramData) return

    const ctx = canvas.getContext('2d')!
    const { width, height } = canvas
    const currentData = histogramData[activeTab]
    
    ctx.fillStyle = 'rgba(5, 5, 15, 1)'
    ctx.fillRect(0, 0, width, height)

    const { bins } = currentData
    const barWidth = width / bins.length
    const maxBin = Math.max(...bins)

    for (let i = 0; i < bins.length; i++) {
      const barHeight = settings.logarithmic ? 
        Math.log(bins[i] + 1e-10) / Math.log(maxBin + 1e-10) * height :
        (bins[i] / maxBin) * height

      const x = i * barWidth
      const y = height - barHeight

      const color = getBarColor(i / bins.length, bins[i] / maxBin, settings.colorScheme)
      ctx.fillStyle = color
      ctx.fillRect(x, y, barWidth - 1, barHeight)
    }

    if (settings.showStatistics) {
      drawStatistics(ctx, width, height)
    }
  }, [histogramData, activeTab, settings])

  const getBarColor = (position: number, intensity: number, scheme: string): string => {
    switch (scheme) {
      case 'classic': return `rgba(0, 150, 255, ${0.7 + intensity * 0.3})`
      case 'heatmap': return intensity < 0.5 ? `rgba(${Math.floor(255 * intensity * 2)}, 0, 255, 0.8)` : `rgba(255, ${Math.floor(255 * (intensity - 0.5) * 2)}, 0, 0.8)`
      case 'gradient': return `hsla(${position * 240}, 70%, ${50 + intensity * 30}%, 0.8)`
      case 'neon': return `rgba(0, 255, ${Math.floor(255 * (1 - position))}, ${0.6 + intensity * 0.4})`
      default: return `rgba(0, 150, 255, 0.7)`
    }
  }

  const drawStatistics = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(width - 150, 10, 140, 80)
    ctx.fillStyle = 'white'
    ctx.font = '11px monospace'
    
    const dynamicRange = Math.abs(analysis.peakLevel - analysis.rmsLevel)
    const crestFactor = Math.abs(analysis.peakLevel / analysis.rmsLevel)
    
    const lines = [
      `Peak: ${analysis.peakLevel.toFixed(1)} dB`,
      `RMS: ${analysis.rmsLevel.toFixed(1)} dB`,
      `LUFS: ${analysis.lufsIntegrated.toFixed(1)}`,
      `DR: ${dynamicRange.toFixed(1)} dB`,
      `Crest: ${crestFactor.toFixed(2)}`
    ]

    lines.forEach((line, i) => {
      ctx.fillText(line, width - 140, 30 + i * 12)
    })
  }

  useEffect(() => {
    generateHistogramData()
  }, [generateHistogramData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      const ctx = canvas.getContext('2d')!
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      renderHistogram()
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [renderHistogram])

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <Card className={`histogram-visualization ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-[color:var(--primary-ink)]" />
            Histogram Analysis - {fileName}
          </CardTitle>
          <Badge variant="secondary">{settings.bins} bins</Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={(tab) => setActiveTab(tab as any)} className="w-full mb-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="amplitude">Amplitude</TabsTrigger>
            <TabsTrigger value="rms">RMS</TabsTrigger>
            <TabsTrigger value="spectral">Spectral</TabsTrigger>
            <TabsTrigger value="loudness">Loudness</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Bins: {settings.bins}</label>
            <Slider
              value={[settings.bins]}
              onValueChange={([value]) => updateSetting('bins', value)}
              min={64}
              max={512}
              step={16}
              className="w-full"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={settings.logarithmic ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSetting('logarithmic', !settings.logarithmic)}
            >
              Log Scale
            </Button>
            <Button
              variant={settings.showStatistics ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSetting('showStatistics', !settings.showStatistics)}
            >
              Stats
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Color Scheme</label>
          <div className="flex gap-2">
            {(['classic', 'heatmap', 'gradient', 'neon'] as const).map((scheme) => (
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

        <div className="relative h-64 bg-gradient-to-br from-secondary to-black rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair"
            style={{ display: 'block' }}
          />
          
          {!histogramData && (
            <div className="absolute inset-0 flex items-center justify-center bg-secondary/80">
              <div className="text-center text-white">
                <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                <p>Generating histogram...</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            Histogram analysis mostra la distribuzione di valori audio. 
            {audioData ? ' Basato su dati audio reali.' : ' Simulazione basata su analisi.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}