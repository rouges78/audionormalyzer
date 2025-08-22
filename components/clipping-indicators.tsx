import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AudioAnalysis } from '@/types/audio'
import { AlertTriangle, Activity, Eye, EyeOff, Zap } from 'lucide-react'

interface ClippingIndicatorsProps {
  analysis: AudioAnalysis
  fileName: string
  isRealTime?: boolean
  className?: string
}

interface ClippingEvent {
  timestamp: number
  level: number
  duration: number
  channel: number
}

export function ClippingIndicators({ 
  analysis, 
  fileName, 
  isRealTime = false, 
  className 
}: ClippingIndicatorsProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [clippingEvents, setClippingEvents] = useState<ClippingEvent[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)

  // Simulate real-time clipping detection
  useEffect(() => {
    if (!isRealTime || !isMonitoring) return

    const interval = setInterval(() => {
      // Simulate clipping detection based on analysis data
      if (analysis.hasClipping && Math.random() < 0.3) {
        const newEvent: ClippingEvent = {
          timestamp: Date.now(),
          level: analysis.peakLevel + (Math.random() * 2), // Slightly above peak
          duration: Math.random() * 50 + 10, // 10-60ms
          channel: Math.floor(Math.random() * analysis.channels)
        }
        
        setClippingEvents(prev => [...prev.slice(-9), newEvent]) // Keep last 10 events
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isRealTime, isMonitoring, analysis])

  const getClippingSeverity = () => {
    if (!analysis.hasClipping) return 'none'
    
    const peakLevel = analysis.peakLevel
    if (peakLevel > 3) return 'severe'
    if (peakLevel > 1) return 'moderate'
    return 'mild'
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'severe':
        return 'bg-red-500 text-white'
      case 'moderate':
        return 'bg-orange-500 text-white'
      case 'mild':
        return 'bg-yellow-500 text-black'
      default:
        return 'bg-green-500 text-white'
    }
  }

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'severe':
        return 'Clipping Severo'
      case 'moderate':
        return 'Clipping Moderato'
      case 'mild':
        return 'Clipping Lieve'
      default:
        return 'Nessun Clipping'
    }
  }

  const getClippingPercentage = () => {
    // Estimate clipping percentage based on how much the peak exceeds 0dB
    if (!analysis.hasClipping) return 0
    
    const excessDb = Math.max(0, analysis.peakLevel)
    return Math.min(100, excessDb * 10) // Rough estimation
  }

  const severity = getClippingSeverity()
  const clippingPercentage = getClippingPercentage()

  return (
    <Card className={`audio-card ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-purple-800" />
            Rilevamento Clipping - {fileName}
          </CardTitle>
          
          {isRealTime && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMonitoring(!isMonitoring)}
              className={`p-2 ${isMonitoring ? 'text-green-600' : 'text-gray-400'}`}
            >
              <Activity className={`h-4 w-4 ${isMonitoring ? 'animate-pulse' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Main Clipping Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${analysis.hasClipping ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {analysis.hasClipping ? 'Clipping Rilevato' : 'Nessun Clipping'}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Peak: {analysis.peakLevel.toFixed(2)} dB | True Peak: {analysis.truePeak.toFixed(2)} dBTP
                </div>
              </div>
            </div>
            
            <Badge className={getSeverityColor(severity)}>
              {getSeverityText(severity)}
            </Badge>
          </div>

          {/* Clipping Metrics */}
          {analysis.hasClipping && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {clippingPercentage.toFixed(1)}%
                </div>
                <div className="text-sm text-red-600 dark:text-red-400">
                  Stima Clipping
                </div>
              </div>
              
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {Math.max(0, analysis.peakLevel).toFixed(1)} dB
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  Eccesso Peak
                </div>
              </div>
              
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {Math.max(0, analysis.truePeak + 1).toFixed(1)} dB
                </div>
                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                  Eccesso True Peak
                </div>
              </div>
            </div>
          )}

          {/* Real-time Events */}
          {isRealTime && clippingEvents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 dark:text-white">Eventi Recenti</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                  className="p-2"
                >
                  {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              
              {showDetails && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {clippingEvents.slice().reverse().map((event, index) => (
                    <div key={event.timestamp} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3 w-3 text-red-500" />
                        <span>Ch {event.channel + 1}</span>
                      </div>
                      <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                        <span>{event.level.toFixed(1)} dB</span>
                        <span>{event.duration.toFixed(0)}ms</span>
                        <span className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recommendations */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Raccomandazioni</h4>
            
            {!analysis.hasClipping ? (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Audio Pulito</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  Nessun clipping rilevato. Il segnale è entro i limiti accettabili.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Azione Richiesta</span>
                  </div>
                  <ul className="text-sm text-red-600 dark:text-red-300 space-y-1">
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-red-600 dark:bg-red-300 rounded-full"></div>
                      Ridurre il gain di {Math.max(0, analysis.peakLevel + 1).toFixed(1)} dB
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-red-600 dark:bg-red-300 rounded-full"></div>
                      Applicare un limiter per prevenire clipping futuro
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-red-600 dark:bg-red-300 rounded-full"></div>
                      Considerare la normalizzazione per ottimizzare i livelli
                    </li>
                  </ul>
                </div>
                
                {severity === 'severe' && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                      <Zap className="h-4 w-4" />
                      <span className="font-medium">Clipping Severo</span>
                    </div>
                    <p className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                      Il clipping è molto evidente e può causare distorsione udibile. 
                      Si raccomanda vivamente la correzione prima della distribuzione.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clear Events Button */}
          {isRealTime && clippingEvents.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClippingEvents([])}
              className="w-full"
            >
              Cancella Eventi
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}