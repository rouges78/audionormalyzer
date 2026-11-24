/**
 * Client-side audio preview & normalization utilities (Web Audio API).
 *
 * This module runs ONLY in the browser. It provides a real, approximate
 * preview of the normalization by applying the predicted gain
 * directly to the audio, without depending on server-side FFmpeg.
 *
 * Note: it is a gain-based preview. The starting LUFS/peak measurement
 * comes from the backend analysis; here we simply apply the gain
 * needed to reach the target. "True" EBU R128 normalization
 * (two-pass measurement + true-peak limiting) remains task core-04.
 */

import type { AudioAnalysis, NormalizationOptions, AnalysisPrediction } from '@/types/audio'

export interface GainComputation {
  /** Gain to apply, in dB. */
  gainDb: number
  /** Corresponding linear factor (10^(dB/20)). */
  gainLinear: number
  /** Was the gain reduced to avoid clipping? */
  limited: boolean
  /** Estimated peak after the gain, in dBFS (useful to warn about clipping). */
  predictedPeakDb: number
}

const TRUE_PEAK_CEILING_DB = -1 // dBTP: typical safety ceiling for streaming

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

export function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(linear, 1e-9))
}

/**
 * Computes the gain needed to reach the chosen target, with a
 * safety ceiling on the peak to avoid digital clipping.
 */
export function computeGain(
  analysis: Pick<AudioAnalysis, 'peakLevel' | 'lufsIntegrated' | 'truePeak'>,
  options: Pick<NormalizationOptions, 'method' | 'targetLevel'>,
  { safePeak = true }: { safePeak?: boolean } = {}
): GainComputation {
  const reference = options.method === 'peak' ? analysis.peakLevel : analysis.lufsIntegrated
  let gainDb = options.targetLevel - reference

  // Most reliable starting peak available
  const startPeakDb = Number.isFinite(analysis.truePeak) ? analysis.truePeak : analysis.peakLevel

  let limited = false
  if (safePeak) {
    const maxGainBeforeClip = TRUE_PEAK_CEILING_DB - startPeakDb
    if (gainDb > maxGainBeforeClip) {
      gainDb = maxGainBeforeClip
      limited = true
    }
  }

  const predictedPeakDb = startPeakDb + gainDb
  return { gainDb, gainLinear: dbToLinear(gainDb), limited, predictedPeakDb }
}

/**
 * Projects the original analysis after applying a constant gain.
 * A pure gain shifts all dB levels by the same amount.
 */
export function predictAnalysis(analysis: AudioAnalysis, gainDb: number): AnalysisPrediction {
  return {
    peakLevel: analysis.peakLevel + gainDb,
    rmsLevel: analysis.rmsLevel + gainDb,
    lufsIntegrated: analysis.lufsIntegrated + gainDb,
    truePeak: analysis.truePeak + gainDb,
    gainApplied: gainDb,
  }
}

let sharedCtx: AudioContext | null = null
function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('Web Audio non disponibile: contesto non-browser')
  }
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) throw new Error('Web Audio API non supportata da questo browser')
  if (!sharedCtx) sharedCtx = new Ctor()
  return sharedCtx
}

/** Decodes an audio File into an AudioBuffer. */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = getAudioContext()
  const arrayBuffer = await file.arrayBuffer()
  try {
    // Promise-based decodeAudioData; copy because some impls consume the buffer
    return await ctx.decodeAudioData(arrayBuffer.slice(0))
  } catch (err) {
    throw new Error(
      `Impossibile decodificare "${file.name}". Il formato potrebbe non essere ` +
      `supportato dal browser per l'anteprima (es. alcuni FLAC).`
    )
  }
}

/**
 * Renders a version of the AudioBuffer with the gain applied and
 * encodes it as 16-bit PCM WAV. Uses OfflineAudioContext (headless rendering).
 */
export async function renderNormalizedWav(
  source: AudioBuffer,
  gainLinear: number
): Promise<Blob> {
  const OfflineCtor =
    (typeof window !== 'undefined' &&
      (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)) ||
    null
  if (!OfflineCtor) throw new Error('OfflineAudioContext non supportato')

  const offline: OfflineAudioContext = new OfflineCtor(
    source.numberOfChannels,
    source.length,
    source.sampleRate
  )
  const src = offline.createBufferSource()
  src.buffer = source
  const gain = offline.createGain()
  gain.gain.value = gainLinear
  src.connect(gain)
  gain.connect(offline.destination)
  src.start(0)

  const rendered = await offline.startRendering()
  return audioBufferToWavBlob(rendered)
}

/** Encodes an AudioBuffer into a WAV Blob (16-bit little-endian PCM). */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const numFrames = buffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = numFrames * blockAlign
  const headerSize = 44

  const ab = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(ab)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // audio format = PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  // Interleave + clamp + int16
  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))

  let offset = headerSize
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i]
      sample = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([ab], { type: 'audio/wav' })
}

/** Measures the real (sampled) peak of an AudioBuffer, in dBFS. */
export function measurePeakDb(buffer: AudioBuffer): number {
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i])
      if (a > peak) peak = a
    }
  }
  return linearToDb(peak)
}
