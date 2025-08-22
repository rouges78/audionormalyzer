import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  SkipBack, 
  SkipForward,
  Headphones,
  RotateCcw
} from 'lucide-react'

interface AudioPlayerProps {
  originalFile?: string
  processedFile?: string
  fileName: string
  className?: string
  onTimeUpdate?: (currentTime: number, duration: number) => void
}

export function AudioPlayer({ 
  originalFile, 
  processedFile, 
  fileName, 
  className,
  onTimeUpdate 
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState([75])
  const [isMuted, setIsMuted] = useState(false)
  const [activeVersion, setActiveVersion] = useState<'original' | 'processed'>('original')
  const [isLoading, setIsLoading] = useState(false)
  
  const originalAudioRef = useRef<HTMLAudioElement>(null)
  const processedAudioRef = useRef<HTMLAudioElement>(null)

  const getCurrentAudio = () => {
    return activeVersion === 'original' ? originalAudioRef.current : processedAudioRef.current
  }

  const getInactiveAudio = () => {
    return activeVersion === 'original' ? processedAudioRef.current : originalAudioRef.current
  }

  useEffect(() => {
    const audio = getCurrentAudio()
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      onTimeUpdate?.(audio.currentTime, audio.duration)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoading(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    const handleLoadStart = () => {
      setIsLoading(true)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('loadstart', handleLoadStart)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('loadstart', handleLoadStart)
    }
  }, [activeVersion, onTimeUpdate])

  useEffect(() => {
    const audio = getCurrentAudio()
    if (audio) {
      audio.volume = isMuted ? 0 : volume[0] / 100
    }
  }, [volume, isMuted, activeVersion])

  const togglePlayPause = async () => {
    const audio = getCurrentAudio()
    if (!audio) return

    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        // Sync time with inactive audio
        const inactiveAudio = getInactiveAudio()
        if (inactiveAudio) {
          inactiveAudio.currentTime = audio.currentTime
        }
        
        await audio.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error('Error playing audio:', error)
    }
  }

  const stop = () => {
    const audio = getCurrentAudio()
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      setCurrentTime(0)
      setIsPlaying(false)
    }
  }

  const seek = (newTime: number) => {
    const audio = getCurrentAudio()
    if (audio) {
      audio.currentTime = newTime
      setCurrentTime(newTime)
      
      // Sync with inactive audio
      const inactiveAudio = getInactiveAudio()
      if (inactiveAudio) {
        inactiveAudio.currentTime = newTime
      }
    }
  }

  const skipBackward = () => {
    const newTime = Math.max(0, currentTime - 10)
    seek(newTime)
  }

  const skipForward = () => {
    const newTime = Math.min(duration, currentTime + 10)
    seek(newTime)
  }

  const switchVersion = async (version: 'original' | 'processed') => {
    if (version === activeVersion) return

    const currentAudio = getCurrentAudio()
    const wasPlaying = isPlaying
    const currentTimeStamp = currentTime

    // Pause current audio
    if (currentAudio && isPlaying) {
      currentAudio.pause()
      setIsPlaying(false)
    }

    // Switch version
    setActiveVersion(version)

    // Wait for next tick to ensure refs are updated
    setTimeout(async () => {
      const newAudio = getCurrentAudio()
      if (newAudio) {
        newAudio.currentTime = currentTimeStamp
        
        if (wasPlaying) {
          try {
            await newAudio.play()
            setIsPlaying(true)
          } catch (error) {
            console.error('Error switching audio version:', error)
          }
        }
      }
    }, 50)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const hasProcessedVersion = !!processedFile

  return (
    <Card className={`audio-card ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading flex items-center gap-2 text-base">
          <Headphones className="h-4 w-4 text-purple-800" />
          Audio Player - {fileName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Hidden Audio Elements */}
          {originalFile && (
            <audio
              ref={originalAudioRef}
              src={originalFile}
              preload="metadata"
            />
          )}
          {processedFile && (
            <audio
              ref={processedAudioRef}
              src={processedFile}
              preload="metadata"
            />
          )}

          {/* Version Selector */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant={activeVersion === 'original' ? 'default' : 'outline'}
              size="sm"
              onClick={() => switchVersion('original')}
              disabled={!originalFile}
              className={activeVersion === 'original' ? 'bg-purple-800 hover:bg-purple-900' : ''}
            >
              Originale
            </Button>
            <Button
              variant={activeVersion === 'processed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => switchVersion('processed')}
              disabled={!hasProcessedVersion}
              className={activeVersion === 'processed' ? 'bg-purple-800 hover:bg-purple-900' : ''}
            >
              Elaborato
              {!hasProcessedVersion && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  N/A
                </Badge>
              )}
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <Badge variant="outline" className="text-xs">
                {activeVersion === 'original' ? 'Originale' : 'Elaborato'}
              </Badge>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="relative">
              <Slider
                value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
                onValueChange={([value]) => {
                  const newTime = (value / 100) * duration
                  seek(newTime)
                }}
                max={100}
                step={0.1}
                className="w-full"
                disabled={duration === 0}
              />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={skipBackward}
              disabled={duration === 0}
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={togglePlayPause}
              disabled={duration === 0 || isLoading}
              className="w-12 h-12"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={stop}
              disabled={duration === 0}
            >
              <Square className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={skipForward}
              disabled={duration === 0}
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => seek(0)}
              disabled={duration === 0}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="p-2"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            
            <div className="flex-1">
              <Slider
                value={volume}
                onValueChange={setVolume}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            
            <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[3rem]">
              {isMuted ? '0%' : `${volume[0]}%`}
            </span>
          </div>

          {/* A/B Comparison Info */}
          {hasProcessedVersion && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 mb-2">
                <Headphones className="h-4 w-4" />
                <span className="font-medium">Confronto A/B</span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                Usa i pulsanti sopra per passare tra la versione originale e quella elaborata. 
                La posizione di riproduzione viene sincronizzata automaticamente.
              </p>
            </div>
          )}

          {/* No Audio Warning */}
          {!originalFile && !processedFile && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Nessun file audio disponibile per la riproduzione
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}