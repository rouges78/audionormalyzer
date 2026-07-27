import React, { useState } from 'react'
import { AudioAnalysis } from '@/types/audio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WaveformDisplay } from './waveform-display'
import { LoudnessRangeDisplay } from './loudness-range-display'
import { ClippingIndicators } from './clipping-indicators'
import { AlertTriangle, Volume2, BarChart3, Clock, Headphones, Activity, TrendingUp } from 'lucide-react'

interface AudioAnalysisDisplayProps {
  analysis: AudioAnalysis
  fileName: string
  className?: string
}

export function AudioAnalysisDisplay({ analysis, fileName, className }: AudioAnalysisDisplayProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFrequency = (hz: number) => {
    if (hz >= 1000) {
      return `${(hz / 1000).toFixed(1)} kHz`
    }
    return `${hz} Hz`
  }

  const getLoudnessColor = (lufs: number) => {
    if (lufs > -14) return 'text-[color:var(--danger)]'
    if (lufs > -18) return 'text-[color:var(--warning)]'
    return 'text-[color:var(--success)]'
  }

  const getPeakColor = (peak: number) => {
    if (peak > -1) return 'text-[color:var(--danger)]'
    if (peak > -3) return 'text-[color:var(--warning)]'
    return 'text-[color:var(--success)]'
  }

  const getDynamicRange = () => {
    return Math.abs(analysis.peakLevel - analysis.rmsLevel)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Panoramica
          </TabsTrigger>
          <TabsTrigger value="waveform" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Waveform
          </TabsTrigger>
          <TabsTrigger value="loudness" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Loudness
          </TabsTrigger>
          <TabsTrigger value="clipping" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Clipping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="audio-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-[color:var(--primary-ink)]" />
                Analisi Audio - {fileName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* File Info Header */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {analysis.hasClipping && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Clipping
                      </Badge>
                    )}
                    
                    {analysis.lufsIntegrated > -14 && (
                      <Badge variant="secondary" className="text-xs bg-[color:var(--tint-warning)] text-[color:var(--warning)]">
                        Sopra Standard Streaming
                      </Badge>
                    )}
                    
                    {analysis.peakLevel > -1 && (
                      <Badge variant="secondary" className="text-xs bg-[color:var(--tint-warning-strong)] text-[color:var(--warning-strong)]">
                        Peak Elevato
                      </Badge>
                    )}
                    
                    {getDynamicRange() < 6 && (
                      <Badge variant="secondary" className="text-xs bg-[color:var(--tint-danger)] text-[color:var(--danger)]">
                        Bassa Dinamica
                      </Badge>
                    )}
                    
                    {getDynamicRange() > 20 && (
                      <Badge variant="secondary" className="text-xs bg-[color:var(--tint-success)] text-[color:var(--success)]">
                        Alta Dinamica
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Basic Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Durata</p>
                      <p className="font-medium">{formatDuration(analysis.duration)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Canali</p>
                      <p className="font-medium">
                        {analysis.channels === 1 ? 'Mono' : analysis.channels === 2 ? 'Stereo' : `${analysis.channels}ch`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Sample Rate</p>
                      <p className="font-medium">{formatFrequency(analysis.sampleRate)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Dynamic Range</p>
                      <p className="font-medium">{getDynamicRange().toFixed(1)} dB</p>
                    </div>
                  </div>
                </div>

                {/* Audio Levels */}
                <div className="space-y-3">
                  <h5 className="font-medium text-foreground">Livelli Audio</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Loudness (LUFS) */}
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Loudness (LUFS)</span>
                        <span className={`text-sm font-medium ${getLoudnessColor(analysis.lufsIntegrated)}`}>
                          {analysis.lufsIntegrated.toFixed(1)} LUFS
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Target streaming: -14 LUFS
                      </div>
                    </div>

                    {/* Peak Level */}
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Peak Level</span>
                        <span className={`text-sm font-medium ${getPeakColor(analysis.peakLevel)}`}>
                          {analysis.peakLevel.toFixed(1)} dB
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Limite consigliato: -1 dB
                      </div>
                    </div>

                    {/* RMS Level */}
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">RMS Level</span>
                        <span className="text-sm font-medium text-foreground">
                          {analysis.rmsLevel.toFixed(1)} dB
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Livello medio percepito
                      </div>
                    </div>

                    {/* True Peak */}
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">True Peak</span>
                        <span className={`text-sm font-medium ${getPeakColor(analysis.truePeak)}`}>
                          {analysis.truePeak.toFixed(1)} dBTP
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Picco reale inter-sample
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waveform">
          <WaveformDisplay 
            analysis={analysis}
            fileName={fileName}
          />
        </TabsContent>

        <TabsContent value="loudness">
          <LoudnessRangeDisplay 
            analysis={analysis}
            fileName={fileName}
          />
        </TabsContent>

        <TabsContent value="clipping">
          <ClippingIndicators 
            analysis={analysis}
            fileName={fileName}
            isRealTime={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}