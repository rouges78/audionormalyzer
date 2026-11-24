/**
 * Web Audio engine: browser-side normalization preview.
 *
 * It does not depend on ffmpeg. It decodes the audio with the Web Audio API, measures the
 * peak/RMS and applies a constant gain producing a WAV (Blob). It is
 * an approximate PREVIEW: it neither measures the real integrated LUFS nor performs
 * true-peak limiting, so final "loudness" normalization remains
 * the job of the WASM/native engines.
 *
 * It reuses the existing utilities in `@/lib/audio-preview`.
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
  // 'path' is not supported in the browser: handled upstream by assertAccepts.
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
      // The Web Audio API does not provide a real LUFS/true-peak measurement.
      lufsIntegrated: NaN,
      truePeak: peakLevel, // approximation: sampled peak
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
      // Without a real LUFS measurement we cannot normalize for loudness.
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
      finalLoudness: NaN, // peak-based preview: final LUFS not measured
      processingTime: Date.now() - start,
    }
  }
}

export function createWebAudioEngine(): WebAudioEngine {
  return new WebAudioEngine()
}
