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
        return 'bg-[color:var(--danger)] text-[color:var(--status-foreground)]'
      case 'moderate':
        return 'bg-[color:var(--warning-strong)] text-[color:var(--status-foreground)]'
      case 'mild':
        return 'bg-[color:var(--warning)] text-[color:var(--status-foreground)]'
      default:
        return 'bg-[color:var(--success)] text-[color:var(--status-foreground)]'
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
            <AlertTriangle className="h-4 w-4 text-[color:var(--primary-ink)]" />
            Rilevamento Clipping - {fileName}
          </CardTitle>
          
          {isRealTime && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMonitoring(!isMonitoring)}
              className={`p-2 ${isMonitoring ? 'text-[color:var(--success)]' : 'text-muted-foreground'}`}
            >
              <Activity className={`h-4 w-4 ${isMonitoring ? 'animate-pulse' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Main Clipping Status */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${analysis.hasClipping ? 'bg-[color:var(--danger)] animate-pulse' : 'bg-[color:var(--success)]'}`}></div>
              <div>
                <div className="font-medium text-foreground">
                  {analysis.hasClipping ? 'Clipping Rilevato' : 'Nessun Clipping'}
                </div>
                <div className="text-sm text-muted-foreground">
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
              <div className="text-center p-3 bg-[color:var(--tint-danger)] rounded-lg">
                <div className="text-2xl font-bold text-[color:var(--danger)]">
                  {clippingPercentage.toFixed(1)}%
                </div>
                <div className="text-sm text-[color:var(--danger)]">
                  Stima Clipping
                </div>
              </div>
              
              <div className="text-center p-3 bg-[color:var(--tint-warning-strong)] rounded-lg">
                <div className="text-2xl font-bold text-[color:var(--warning-strong)]">
                  {Math.max(0, analysis.peakLevel).toFixed(1)} dB
                </div>
                <div className="text-sm text-[color:var(--warning-strong)]">
                  Eccesso Peak
                </div>
              </div>
              
              <div className="text-center p-3 bg-[color:var(--tint-warning)] rounded-lg">
                <div className="text-2xl font-bold text-[color:var(--warning)]">
                  {Math.max(0, analysis.truePeak + 1).toFixed(1)} dB
                </div>
                <div className="text-sm text-[color:var(--warning)]">
                  Eccesso True Peak
                </div>
              </div>
            </div>
          )}

          {/* Real-time Events */}
          {isRealTime && clippingEvents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">Eventi Recenti</h4>
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
                    <div key={event.timestamp} className="flex items-center justify-between p-2 bg-[color:var(--tint-danger)] rounded text-sm">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3 w-3 text-[color:var(--danger)]" />
                        <span>Ch {event.channel + 1}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[color:var(--danger)]">
                        <span>{event.level.toFixed(1)} dB</span>
                        <span>{event.duration.toFixed(0)}ms</span>
                        <span className="text-xs text-muted-foreground">
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
            <h4 className="font-medium text-foreground">Raccomandazioni</h4>
            
            {!analysis.hasClipping ? (
              <div className="p-3 bg-[color:var(--tint-success)] border border-[color:var(--success)] rounded-lg">
                <div className="flex items-center gap-2 text-[color:var(--success)]">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Audio Pulito</span>
                </div>
                <p className="text-sm text-[color:var(--success)] mt-1">
                  Nessun clipping rilevato. Il segnale è entro i limiti accettabili.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-[color:var(--tint-danger)] border border-[color:var(--danger)] rounded-lg">
                  <div className="flex items-center gap-2 text-[color:var(--danger)] mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Azione Richiesta</span>
                  </div>
                  <ul className="text-sm text-[color:var(--danger)] space-y-1">
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-[color:var(--danger)] rounded-full"></div>
                      Ridurre il gain di {Math.max(0, analysis.peakLevel + 1).toFixed(1)} dB
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-[color:var(--danger)] rounded-full"></div>
                      Applicare un limiter per prevenire clipping futuro
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-[color:var(--danger)] rounded-full"></div>
                      Considerare la normalizzazione per ottimizzare i livelli
                    </li>
                  </ul>
                </div>
                
                {severity === 'severe' && (
                  <div className="p-3 bg-[color:var(--tint-warning-strong)] border border-[color:var(--warning-strong)] rounded-lg">
                    <div className="flex items-center gap-2 text-[color:var(--warning-strong)]">
                      <Zap className="h-4 w-4" />
                      <span className="font-medium">Clipping Severo</span>
                    </div>
                    <p className="text-sm text-[color:var(--warning-strong)] mt-1">
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