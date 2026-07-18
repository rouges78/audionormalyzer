/**
 * Engine Web Audio: anteprima di normalizzazione lato browser.
 *
 * Non dipende da ffmpeg. Decodifica l'audio con la Web Audio API, misura il
 * picco/RMS e applica un guadagno costante producendo un WAV (Blob). È
 * un'ANTEPRIMA approssimata: non misura la LUFS integrata reale né esegue
 * true-peak limiting, quindi la normalizzazione "loudness" definitiva resta
 * appannaggio degli engine WASM/nativo.
 *
 * Riusa le utility già esistenti in `@/lib/audio-preview`.
 */

import type {
  AudioAnalysis,
  NormalizationOptions,
  NormalizationResult,
} from '@/types/audio'
import {
  computeGain,
  decodeAudioFile,
  linearToDb,
  renderNormalizedWav,
  measurePeakDb,
} from '@/lib/audio-preview'
import {
  AudioEngine,
  EngineCapabilities,
  EngineInput,
  EngineKind,
  UnsupportedCapabilityError,
  assertAccepts,
} from './types'

function measureRmsDb(buffer: AudioBuffer): number {
  let sumSquares = 0
  let count = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      sumSquares += data[i] * data[i]
    }
    count += data.length
  }
  if (count === 0) return -Infinity
  return linearToDb(Math.sqrt(sumSquares / count))
}

async function toFile(input: EngineInput): Promise<File> {
  if (input.kind === 'file') return input.file
  if (input.kind === 'buffer') {
    return new File([input.data], input.fileName ?? 'audio', {
      type: 'application/octet-stream',
    })
  }
  // 'path' non è supportato nel browser: gestito da assertAccepts a monte.
  throw new Error('Input non supportato dal WebAudioEngine')
}

export class WebAudioEngine implements AudioEngine {
  readonly name = 'web-audio'
  readonly kind: EngineKind = 'web-audio'
  readonly capabilities: EngineCapabilities = {
    runtime: 'browser',
    measuresLufs: false,
    measuresLoudnessRange: false,
    truePeakLimiting: false,
    previewOnly: true,
    accepts: ['file', 'buffer'],
  }

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof (window.AudioContext || (window as any).webkitAudioContext) !==
        'undefined'
    )
  }

  async analyze(input: EngineInput): Promise<AudioAnalysis> {
    assertAccepts(this, input)
    const file = await toFile(input)
    const buffer = await decodeAudioFile(file)

    const peakLevel = measurePeakDb(buffer)
    const rmsLevel = measureRmsDb(buffer)

    return {
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      peakLevel,
      rmsLevel,
      // La Web Audio API non fornisce una misura LUFS/true-peak reale.
      lufsIntegrated: NaN,
      truePeak: peakLevel, // approssimazione: picco campionato
      hasClipping: peakLevel >= 0,
      format: file.name.includes('.')
        ? file.name.split('.').pop()!.toUpperCase()
        : undefined,
    }
  }

  async normalize(
    input: EngineInput,
    options: NormalizationOptions,
  ): Promise<NormalizationResult> {
    assertAccepts(this, input)

    if (options.method === 'loudness') {
      // Senza misura LUFS reale non possiamo normalizzare in loudness.
      throw new UnsupportedCapabilityError(
        this.name,
        'normalizzazione loudness (LUFS reale non misurabile lato browser)',
      )
    }

    const start = Date.now()
    const file = await toFile(input)
    const buffer = await decodeAudioFile(file)

    const analysis = {
      peakLevel: measurePeakDb(buffer),
      lufsIntegrated: NaN,
      truePeak: measurePeakDb(buffer),
    }
    const gain = computeGain(analysis, options)
    const blob = await renderNormalizedWav(buffer, gain.gainLinear)
    const outputUrl =
      typeof URL !== 'undefined' && 'createObjectURL' in URL
        ? URL.createObjectURL(blob)
        : undefined

    return {
      success: true,
      outputBlob: blob,
      outputUrl,
      gainApplied: gain.gainDb,
      finalLoudness: NaN, // anteprima peak-based: LUFS finale non misurata
      processingTime: Date.now() - start,
    }
  }
}

export function createWebAudioEngine(): WebAudioEngine {
  return new WebAudioEngine()
}
