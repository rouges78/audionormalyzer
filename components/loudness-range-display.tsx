import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AudioAnalysis } from '@/types/audio'
import { BarChart3, TrendingUp, Volume2, AlertTriangle } from 'lucide-react'

interface LoudnessRangeDisplayProps {
  analysis: AudioAnalysis
  fileName: string
  className?: string
}

export function LoudnessRangeDisplay({ analysis, fileName, className }: LoudnessRangeDisplayProps) {
  const getDynamicRange = () => {
    return Math.abs(analysis.peakLevel - analysis.rmsLevel)
  }

  const getLoudnessCategory = (lufs: number) => {
    if (lufs > -14) return { category: 'Loud', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' }
    if (lufs > -18) return { category: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' }
    if (lufs > -23) return { category: 'Quiet', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' }
    return { category: 'Very Quiet', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' }
  }

  const getDynamicRangeCategory = (dr: number) => {
    if (dr < 6) return { category: 'Compressed', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' }
    if (dr < 12) return { category: 'Moderate', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' }
    if (dr < 20) return { category: 'Good', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' }
    return { category: 'Excellent', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' }
  }

  const getStreamingCompliance = (lufs: number, truePeak: number) => {
    const issues = []
    
    if (lufs > -14) issues.push('Troppo forte per streaming')
    if (truePeak > -1) issues.push('True peak troppo alto')
    if (lufs < -23) issues.push('Potrebbe essere troppo silenzioso')
    
    return issues
  }

  const loudnessCategory = getLoudnessCategory(analysis.lufsIntegrated)
  const dynamicRange = getDynamicRange()
  const dynamicRangeCategory = getDynamicRangeCategory(dynamicRange)
  const streamingIssues = getStreamingCompliance(analysis.lufsIntegrated, analysis.truePeak)

  // Create visual loudness meter
  const createLoudnessMeter = () => {
    const minLufs = -30
    const maxLufs = -6
    const currentLufs = Math.max(minLufs, Math.min(maxLufs, analysis.lufsIntegrated))
    const percentage = ((currentLufs - minLufs) / (maxLufs - minLufs)) * 100

    return (
      <div className="relative w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {/* Background zones */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 bg-green-200 dark:bg-green-800/50"></div>
          <div className="flex-1 bg-yellow-200 dark:bg-yellow-800/50"></div>
          <div className="flex-1 bg-red-200 dark:bg-red-800/50"></div>
        </div>
        
        {/* Current level indicator */}
        <div 
          className="absolute top-0 left-0 h-full bg-purple-600 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
        
        {/* Target line (-14 LUFS) */}
        <div 
          className="absolute top-0 h-full w-0.5 bg-white shadow-lg"
          style={{ left: `${(((-14) - minLufs) / (maxLufs - minLufs)) * 100}%` }}
        ></div>
        
        {/* Labels */}
        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          <span>-30</span>
          <span>-14</span>
          <span>-6</span>
        </div>
      </div>
    )
  }

  // Create dynamic range meter
  const createDynamicRangeMeter = () => {
    const maxDR = 30
    const percentage = Math.min((dynamicRange / maxDR) * 100, 100)

    return (
      <div className="relative w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {/* Background zones */}
        <div className="absolute inset-0 flex">
          <div className="w-1/5 bg-red-200 dark:bg-red-800/50"></div>
          <div className="w-1/5 bg-yellow-200 dark:bg-yellow-800/50"></div>
          <div className="w-3/5 bg-green-200 dark:bg-green-800/50"></div>
        </div>
        
        {/* Current level indicator */}
        <div 
          className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
        
        {/* Labels */}
        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          <span>0</span>
          <span>15</span>
          <span>30</span>
        </div>
      </div>
    )
  }

  return (
    <Card className={`audio-card ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-purple-800" />
          Analisi Loudness - {fileName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Loudness Meter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Loudness (LUFS)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold">
                  {analysis.lufsIntegrated.toFixed(1)}
                </span>
                <Badge className={loudnessCategory.color}>
                  {loudnessCategory.category}
                </Badge>
              </div>
            </div>
            {createLoudnessMeter()}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Target streaming: -14 LUFS
            </div>
          </div>

          {/* Dynamic Range Meter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Dynamic Range</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold">
                  {dynamicRange.toFixed(1)} dB
                </span>
                <Badge className={dynamicRangeCategory.color}>
                  {dynamicRangeCategory.category}
                </Badge>
              </div>
            </div>
            {createDynamicRangeMeter()}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Range: 0 dB (compressed) - 30+ dB (dynamic)
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400">True Peak</div>
              <div className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                {analysis.truePeak.toFixed(1)} dBTP
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Limite: -1.0 dBTP
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400">Crest Factor</div>
              <div className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                {(analysis.peakLevel - analysis.rmsLevel).toFixed(1)} dB
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Peak - RMS
              </div>
            </div>
          </div>

          {/* Streaming Compliance */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Conformità Streaming</h4>
            
            {streamingIssues.length === 0 ? (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <BarChart3 className="h-4 w-4" />
                  <span className="font-medium">Conforme agli Standard</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  Il file rispetta gli standard di loudness per le piattaforme streaming.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Problemi Rilevati</span>
                </div>
                <ul className="text-sm text-yellow-600 dark:text-yellow-300 space-y-1">
                  {streamingIssues.map((issue, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-yellow-600 dark:bg-yellow-300 rounded-full"></div>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Raccomandazioni</h4>
            <div className="space-y-2 text-sm">
              {analysis.lufsIntegrated > -14 && (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-800 dark:text-blue-200">
                  • Ridurre il volume di {(analysis.lufsIntegrated - (-14)).toFixed(1)} dB per conformità streaming
                </div>
              )}
              
              {analysis.truePeak > -1 && (
                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-orange-800 dark:text-orange-200">
                  • Applicare limiting per ridurre il true peak sotto -1 dBTP
                </div>
              )}
              
              {dynamicRange < 6 && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-800 dark:text-red-200">
                  • Il segnale è molto compresso, considera di preservare più dinamica
                </div>
              )}
              
              {analysis.lufsIntegrated < -23 && (
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-purple-800 dark:text-purple-200">
                  • Il volume potrebbe essere troppo basso per l'ascolto normale
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}