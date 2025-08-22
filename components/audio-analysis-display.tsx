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
    if (lufs > -14) return 'text-red-600 dark:text-red-400'
    if (lufs > -18) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  const getPeakColor = (peak: number) => {
    if (peak > -1) return 'text-red-600 dark:text-red-400'
    if (peak > -3) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
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
                <BarChart3 className="h-4 w-4 text-purple-800" />
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
                      <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        Sopra Standard Streaming
                      </Badge>
                    )}
                    
                    {analysis.peakLevel > -1 && (
                      <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                        Peak Elevato
                      </Badge>
                    )}
                    
                    {getDynamicRange() < 6 && (
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                        Bassa Dinamica
                      </Badge>
                    )}
                    
                    {getDynamicRange() > 20 && (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        Alta Dinamica
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Basic Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Durata</p>
                      <p className="font-medium">{formatDuration(analysis.duration)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Canali</p>
                      <p className="font-medium">
                        {analysis.channels === 1 ? 'Mono' : analysis.channels === 2 ? 'Stereo' : `${analysis.channels}ch`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Sample Rate</p>
                      <p className="font-medium">{formatFrequency(analysis.sampleRate)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Dynamic Range</p>
                      <p className="font-medium">{getDynamicRange().toFixed(1)} dB</p>
                    </div>
                  </div>
                </div>

                {/* Audio Levels */}
                <div className="space-y-3">
                  <h5 className="font-medium text-gray-900 dark:text-white">Livelli Audio</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Loudness (LUFS) */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Loudness (LUFS)</span>
                        <span className={`text-sm font-medium ${getLoudnessColor(analysis.lufsIntegrated)}`}>
                          {analysis.lufsIntegrated.toFixed(1)} LUFS
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Target streaming: -14 LUFS
                      </div>
                    </div>

                    {/* Peak Level */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Peak Level</span>
                        <span className={`text-sm font-medium ${getPeakColor(analysis.peakLevel)}`}>
                          {analysis.peakLevel.toFixed(1)} dB
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Limite consigliato: -1 dB
                      </div>
                    </div>

                    {/* RMS Level */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">RMS Level</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {analysis.rmsLevel.toFixed(1)} dB
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Livello medio percepito
                      </div>
                    </div>

                    {/* True Peak */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">True Peak</span>
                        <span className={`text-sm font-medium ${getPeakColor(analysis.truePeak)}`}>
                          {analysis.truePeak.toFixed(1)} dBTP
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
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