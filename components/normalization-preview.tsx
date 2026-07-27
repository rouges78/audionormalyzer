import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AudioAnalysis, NormalizationOptions } from '@/types/audio'
import { AudioPlayer } from './audio-player'
import { 
  Settings, 
  Volume2, 
  BarChart3, 
  Eye, 
  Zap, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react'

interface NormalizationPreviewProps {
  analysis: AudioAnalysis
  fileName: string
  fileId: string
  originalAudioUrl?: string
  className?: string
  onParametersChange?: (options: NormalizationOptions) => void
  onPreviewGenerate?: (options: NormalizationOptions) => Promise<string>
}

export function NormalizationPreview({
  analysis,
  fileName,
  fileId,
  originalAudioUrl,
  className,
  onParametersChange,
  onPreviewGenerate
}: NormalizationPreviewProps) {
  const [normalizationMethod, setNormalizationMethod] = useState<'peak' | 'loudness'>('loudness')
  const [targetLevel, setTargetLevel] = useState([-14])
  const [preserveFormat, setPreserveFormat] = useState(true)
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string>()
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string>()
  const [lastPreviewParams, setLastPreviewParams] = useState<NormalizationOptions>()

  // Calculate predicted results
  const calculatePredictedResults = () => {
    const currentLevel = normalizationMethod === 'peak' ? analysis.peakLevel : analysis.lufsIntegrated
    const target = targetLevel[0]
    const gainNeeded = target - currentLevel
    
    const predictedPeak = analysis.peakLevel + gainNeeded
    const predictedRms = analysis.rmsLevel + gainNeeded
    const predictedLufs = analysis.lufsIntegrated + gainNeeded
    const predictedTruePeak = analysis.truePeak + gainNeeded
    
    return {
      gainApplied: gainNeeded,
      predictedPeak,
      predictedRms,
      predictedLufs,
      predictedTruePeak,
      willClip: predictedTruePeak > -1,
      willExceedTarget: normalizationMethod === 'loudness' && predictedLufs > -14
    }
  }

  const predicted = calculatePredictedResults()

  // Update parameters when they change
  useEffect(() => {
    const options: NormalizationOptions = {
      method: normalizationMethod,
      targetLevel: targetLevel[0],
      preserveFormat,
      outputPath: '' // Will be set by the backend
    }
    
    onParametersChange?.(options)
  }, [normalizationMethod, targetLevel, preserveFormat, onParametersChange])

  const generatePreview = async () => {
    if (!onPreviewGenerate) return

    const options: NormalizationOptions = {
      method: normalizationMethod,
      targetLevel: targetLevel[0],
      preserveFormat,
      outputPath: ''
    }

    setIsGeneratingPreview(true)
    setPreviewError(undefined)

    try {
      const previewUrl = await onPreviewGenerate(options)
      setPreviewAudioUrl(previewUrl)
      setLastPreviewParams(options)
    } catch (error) {
      console.error('Error generating preview:', error)
      setPreviewError(error instanceof Error ? error.message : 'Errore nella generazione dell\'anteprima')
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  const hasParametersChanged = () => {
    if (!lastPreviewParams) return true
    
    return (
      lastPreviewParams.method !== normalizationMethod ||
      lastPreviewParams.targetLevel !== targetLevel[0] ||
      lastPreviewParams.preserveFormat !== preserveFormat
    )
  }

  const getMethodDescription = (method: 'peak' | 'loudness') => {
    switch (method) {
      case 'peak':
        return 'Normalizza basandosi sul picco massimo del segnale. Mantiene la dinamica relativa.'
      case 'loudness':
        return 'Normalizza basandosi sulla loudness percepita (LUFS). Ideale per streaming e broadcast.'
    }
  }

  const getTargetLevelRange = () => {
    return normalizationMethod === 'peak' ? { min: -20, max: -1 } : { min: -30, max: -6 }
  }

  const range = getTargetLevelRange()

  return (
    <div className={`space-y-4 ${className}`}>
      <Card className="audio-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-[color:var(--primary-ink)]" />
            Anteprima Normalizzazione - {fileName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="parameters" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="parameters" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Parametri
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Anteprima
              </TabsTrigger>
              <TabsTrigger value="comparison" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Confronto
              </TabsTrigger>
            </TabsList>

            <TabsContent value="parameters" className="space-y-4">
              {/* Normalization Method */}
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">Metodo di Normalizzazione</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    variant={normalizationMethod === 'peak' ? 'default' : 'outline'}
                    onClick={() => setNormalizationMethod('peak')}
                    className={`h-auto p-4 flex flex-col items-start gap-2 ${
                      normalizationMethod === 'peak' ? 'bg-[color:var(--cta)] text-[color:var(--cta-foreground)] hover:opacity-90' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      <span className="font-medium">Peak Normalization</span>
                    </div>
                    <p className="text-xs text-left opacity-80">
                      Normalizza al picco massimo
                    </p>
                  </Button>
                  
                  <Button
                    variant={normalizationMethod === 'loudness' ? 'default' : 'outline'}
                    onClick={() => setNormalizationMethod('loudness')}
                    className={`h-auto p-4 flex flex-col items-start gap-2 ${
                      normalizationMethod === 'loudness' ? 'bg-[color:var(--cta)] text-[color:var(--cta-foreground)] hover:opacity-90' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      <span className="font-medium">Loudness Normalization</span>
                    </div>
                    <p className="text-xs text-left opacity-80">
                      Normalizza alla loudness percepita (LUFS)
                    </p>
                  </Button>
                </div>
                
                <div className="p-3 bg-[color:var(--tint-info)] rounded-lg">
                  <p className="text-sm text-[color:var(--info)]">
                    {getMethodDescription(normalizationMethod)}
                  </p>
                </div>
              </div>

              {/* Target Level */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground">Livello Target</h4>
                  <Badge variant="outline">
                    {targetLevel[0]} {normalizationMethod === 'peak' ? 'dB' : 'LUFS'}
                  </Badge>
                </div>
                
                <Slider
                  value={targetLevel}
                  onValueChange={setTargetLevel}
                  min={range.min}
                  max={range.max}
                  step={0.1}
                  className="w-full"
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{range.min} {normalizationMethod === 'peak' ? 'dB' : 'LUFS'}</span>
                  {normalizationMethod === 'loudness' && (
                    <span className="text-[color:var(--primary-ink)]">-14 LUFS (Streaming)</span>
                  )}
                  <span>{range.max} {normalizationMethod === 'peak' ? 'dB' : 'LUFS'}</span>
                </div>
              </div>

              {/* Predicted Results */}
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">Risultati Previsti</h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-sm text-muted-foreground">Gain</div>
                    <div className={`font-mono text-lg font-bold ${
                      Math.abs(predicted.gainApplied) > 6 ? 'text-[color:var(--warning-strong)]' : 'text-foreground'
                    }`}>
                      {predicted.gainApplied > 0 ? '+' : ''}{predicted.gainApplied.toFixed(1)} dB
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-sm text-muted-foreground">Peak</div>
                    <div className={`font-mono text-lg font-bold ${
                      predicted.predictedPeak > -1 ? 'text-[color:var(--danger)]' : 'text-foreground'
                    }`}>
                      {predicted.predictedPeak.toFixed(1)} dB
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-sm text-muted-foreground">LUFS</div>
                    <div className={`font-mono text-lg font-bold ${
                      predicted.predictedLufs > -14 ? 'text-[color:var(--warning)]' : 'text-foreground'
                    }`}>
                      {predicted.predictedLufs.toFixed(1)} LUFS
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-sm text-muted-foreground">True Peak</div>
                    <div className={`font-mono text-lg font-bold ${
                      predicted.predictedTruePeak > -1 ? 'text-[color:var(--danger)]' : 'text-foreground'
                    }`}>
                      {predicted.predictedTruePeak.toFixed(1)} dBTP
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {(predicted.willClip || predicted.willExceedTarget) && (
                  <div className="space-y-2">
                    {predicted.willClip && (
                      <div className="p-3 bg-[color:var(--tint-danger)] border border-[color:var(--danger)] rounded-lg">
                        <div className="flex items-center gap-2 text-[color:var(--danger)]">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">Rischio Clipping</span>
                        </div>
                        <p className="text-sm text-[color:var(--danger)] mt-1">
                          Il true peak supererà -1 dBTP. Si consiglia di ridurre il target level.
                        </p>
                      </div>
                    )}
                    
                    {predicted.willExceedTarget && (
                      <div className="p-3 bg-[color:var(--tint-warning)] border border-[color:var(--warning)] rounded-lg">
                        <div className="flex items-center gap-2 text-[color:var(--warning)]">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">Sopra Standard Streaming</span>
                        </div>
                        <p className="text-sm text-[color:var(--warning)] mt-1">
                          Il risultato supererà -14 LUFS, potrebbe essere ridotto dalle piattaforme streaming.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              {/* Generate Preview Button */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">Genera Anteprima</h4>
                  <p className="text-sm text-muted-foreground">
                    Crea un'anteprima con i parametri attuali
                  </p>
                </div>
                
                <Button
                  onClick={generatePreview}
                  disabled={isGeneratingPreview || !onPreviewGenerate}
                  className="bg-[color:var(--cta)] text-[color:var(--cta-foreground)] hover:opacity-90"
                >
                  {isGeneratingPreview ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      {hasParametersChanged() ? 'Genera Anteprima' : 'Rigenera'}
                    </>
                  )}
                </Button>
              </div>

              {/* Preview Status */}
              {hasParametersChanged() && previewAudioUrl && (
                <div className="p-3 bg-[color:var(--tint-warning-strong)] border border-[color:var(--warning-strong)] rounded-lg">
                  <div className="flex items-center gap-2 text-[color:var(--warning-strong)]">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Parametri Modificati</span>
                  </div>
                  <p className="text-sm text-[color:var(--warning-strong)] mt-1">
                    I parametri sono cambiati dall'ultima anteprima. Genera una nuova anteprima per sentire le modifiche.
                  </p>
                </div>
              )}

              {previewError && (
                <div className="p-3 bg-[color:var(--tint-danger)] border border-[color:var(--danger)] rounded-lg">
                  <div className="flex items-center gap-2 text-[color:var(--danger)]">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Errore</span>
                  </div>
                  <p className="text-sm text-[color:var(--danger)] mt-1">
                    {previewError}
                  </p>
                </div>
              )}

              {!onPreviewGenerate && (
                <div className="p-3 bg-muted border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground text-center">
                    La funzionalità di anteprima sarà disponibile nel prossimo aggiornamento
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="comparison">
              {/* Audio Player for A/B Comparison */}
              <AudioPlayer
                originalFile={originalAudioUrl}
                processedFile={previewAudioUrl}
                fileName={fileName}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}