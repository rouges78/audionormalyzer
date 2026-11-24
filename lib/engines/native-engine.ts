/**
 * Native engine: analysis and normalization with a real ffmpeg (core-04).
 *
 * It is the only engine that **really measures** loudness. The other two
 * declare estimates: WebAudio applies a constant gain, and server-side analysis
 * without ffmpeg so far returned placeholder values marked as
 * `estimated` (see core-03). Here the numbers come from the `ebur128` filter, which is
 * the reference implementation of EBU R128 inside ffmpeg.
 *
 * WHAT IT MEASURES, AND WITH WHAT
 *   `ebur128=peak=sample+true` → I (integrated LUFS), LRA, sample peak, true peak
 *   `volumedetect`             → mean_volume, which we use as the RMS level
 *
 * The two filters are chained in a single pass: `ebur128` passes the
 * audio through unchanged, so `volumedetect` downstream still measures the original.
 * A single pass instead of two halves the cost on long files.
 *
 * WHAT IT DOES NOT DO (yet)
 * Loudness normalization is **single-pass**: `loudnorm` estimates and
 * corrects in the same pass. It is compliant and hits the target on
 * homogeneous material, but on music with wide dynamics two-pass is more precise.
 * That is core-09, and it stays open on purpose.
 */

import { spawn } from 'child_process'
import path from 'path'
import type {
  AudioAnalysis,
  NormalizationOptions,
  NormalizationResult,
} from '@/types/audio'
import { resolveFfmpeg, resolveFfmpegPath } from '@/lib/ffmpeg-binary'
import {
  AudioEngine,
  EngineCapabilities,
  EngineInput,
  EngineKind,
  assertAccepts,
} from './types'

/**
 * `ebur128` writes a log line **for every frame** analyzed: on a
 * five-minute track that is tens of thousands of lines and several MB of
 * stderr, only to use twenty of them at the end. The `framelog=quiet` option that
 * would fix this does not exist in every ffmpeg version (in 4.4 it makes
 * filter initialization fail), so instead of depending on the
 * version we drop the per-frame lines as they arrive: they are recognizable
 * by the ` t: ` marker followed by the timestamp.
 */
const PER_FRAME_LINE = /\]\s+t:\s/

/** Safety cap on how much stderr we keep in memory. */
const MAX_STDERR_BYTES = 256 * 1024

/** Raw outcome of an ffmpeg invocation. */
interface FfmpegRun {
  code: number | null
  stderr: string
}

/**
 * Runs ffmpeg collecting stderr, which is where ffmpeg writes **everything**:
 * diagnostics, errors and the output of the measurement filters.
 *
 * We use `spawn` and not `execFile` precisely to be able to filter while streaming: with
 * execFile stderr accumulates in full before being delivered, and on
 * long files it blows the maxBuffer.
 */
function runFfmpeg(bin: string, args: string[]): Promise<FfmpegRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true })

    let kept = ''
    let pending = ''

    child.stderr.on('data', (chunk: Buffer) => {
      pending += chunk.toString()
      const lines = pending.split('\n')
      // The last element may be an incomplete line: it waits for more.
      pending = lines.pop() ?? ''
      for (const line of lines) {
        if (PER_FRAME_LINE.test(line)) continue
        if (kept.length < MAX_STDERR_BYTES) kept += line + '\n'
      }
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (pending && !PER_FRAME_LINE.test(pending)) kept += pending
      resolve({ code, stderr: kept })
    })
  })
}

/** Converts to a number, returning undefined for `-inf`, `nan` and the like. */
function finite(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

/** Measurements extracted from ffmpeg's stderr. Every field may be missing. */
export interface LoudnessMeasurements {
  lufsIntegrated?: number
  loudnessRange?: number
  samplePeak?: number
  truePeak?: number
  rmsLevel?: number
}

/**
 * Extracts the measurements from the `ebur128` summary and from `volumedetect`.
 *
 * The ebur128 summary is indented and split into sections, and the `Peak:` key
 * appears **twice** — once under "Sample peak", once under "True peak" — with
 * the exact same text. So you cannot search for `Peak:` alone: you have to
 * know which section you are reading. Hence the small state machine.
 *
 * Exported because parsing is the most fragile part of the engine and deserves its own
 * tests, without having to run ffmpeg.
 */
export function parseLoudness(stderr: string): LoudnessMeasurements {
  const out: LoudnessMeasurements = {}
  let section: 'integrated' | 'lra' | 'sample' | 'true' | null = null

  for (const rawLine of stderr.split('\n')) {
    const line = rawLine.trim()

    if (line.startsWith('Integrated loudness')) { section = 'integrated'; continue }
    if (line.startsWith('Loudness range')) { section = 'lra'; continue }
    if (line.startsWith('Sample peak')) { section = 'sample'; continue }
    if (line.startsWith('True peak')) { section = 'true'; continue }

    const i = line.match(/^I:\s*(-?[\d.]+|-?inf)\s*LUFS/i)
    if (i && section === 'integrated') { out.lufsIntegrated = finite(i[1]); continue }

    const lra = line.match(/^LRA:\s*(-?[\d.]+|-?inf)\s*LU/i)
    if (lra && section === 'lra') { out.loudnessRange = finite(lra[1]); continue }

    const peak = line.match(/^Peak:\s*(-?[\d.]+|-?inf)\s*dB/i)
    if (peak) {
      if (section === 'sample') out.samplePeak = finite(peak[1])
      else if (section === 'true') out.truePeak = finite(peak[1])
      continue
    }

    const mean = line.match(/mean_volume:\s*(-?[\d.]+|-?inf)\s*dB/i)
    if (mean) { out.rmsLevel = finite(mean[1]); continue }

    // Safety net: if ebur128 did not produce the sample peak (it depends
    // on the options supported by the version), volumedetect gives it anyway.
    const max = line.match(/max_volume:\s*(-?[\d.]+|-?inf)\s*dB/i)
    if (max && out.samplePeak === undefined) out.samplePeak = finite(max[1])
  }

  return out
}

/** Container data read from the header, not estimated. */
interface ContainerInfo {
  duration: number
  sampleRate: number
  channels: number
  format?: string
  bitrate?: number
}

/**
 * Reads the container data with `music-metadata`, the same library that
 * `audio-processor` has used since 27/07 (core-03). The logic is not duplicated and,
 * above all, no second truth about the same fields is introduced.
 */
async function readContainer(filePath: string): Promise<ContainerInfo> {
  const { parseFile } = await import('music-metadata')
  const meta = await parseFile(filePath, { duration: true })
  const f = meta.format
  return {
    duration: f.duration ?? 0,
    sampleRate: f.sampleRate ?? 0,
    channels: f.numberOfChannels ?? 0,
    format: path.extname(filePath).replace('.', '').toUpperCase() || undefined,
    bitrate: f.bitrate,
  }
}

export class NativeEngine implements AudioEngine {
  readonly name = 'ffmpeg-native'
  readonly kind: EngineKind = 'native'
  readonly capabilities: EngineCapabilities = {
    runtime: 'server',
    measuresLufs: true,
    measuresLoudnessRange: true,
    truePeakLimiting: true,
    previewOnly: false,
    accepts: ['path'],
  }

  /** Available only server side and only if an ffmpeg really responds. */
  async isAvailable(): Promise<boolean> {
    if (typeof window !== 'undefined') return false
    return (await resolveFfmpeg()) !== null
  }

  private async requireBinary(): Promise<string> {
    const bin = await resolveFfmpegPath()
    if (!bin) {
      throw new Error(
        'ffmpeg non trovato. Imposta FFMPEG_PATH, installa il pacchetto ' +
          'ffmpeg-static, oppure rendi ffmpeg raggiungibile dal PATH.',
      )
    }
    return bin
  }

  /**
   * Measures loudness and peaks in a single pass, without producing audio output
   * (`-f null -`): ffmpeg needs a destination, but we throw the bytes away.
   */
  async measure(filePath: string): Promise<LoudnessMeasurements> {
    const bin = await this.requireBinary()
    const { stderr } = await runFfmpeg(bin, [
      '-nostdin',
      '-hide_banner',
      '-i',
      filePath,
      '-af',
      'ebur128=peak=sample+true,volumedetect',
      '-f',
      'null',
      '-',
    ])
    return parseLoudness(stderr)
  }

  async analyze(input: EngineInput): Promise<AudioAnalysis> {
    assertAccepts(this, input)
    const filePath = (input as { kind: 'path'; path: string }).path

    const [container, m] = await Promise.all([
      readContainer(filePath),
      this.measure(filePath),
    ])

    // `source` tells the interface how far to trust the numbers (core-03). Here it is
    // 'measured' only if the LUFS is really there: on a corrupt or empty file
    // ebur128 produces nothing, and it would be wrong to declare a measurement.
    const measured = m.lufsIntegrated !== undefined

    return {
      duration: container.duration,
      sampleRate: container.sampleRate,
      channels: container.channels,
      format: container.format,
      bitrate: container.bitrate,
      peakLevel: m.samplePeak ?? 0,
      rmsLevel: m.rmsLevel ?? 0,
      lufsIntegrated: m.lufsIntegrated ?? 0,
      truePeak: m.truePeak ?? m.samplePeak ?? 0,
      loudnessRange: m.loudnessRange,
      // Clipping: sample peak at 0 dBFS or above. The threshold is not exactly zero
      // because 16-bit quantization produces maxima like -0.0.
      hasClipping: (m.samplePeak ?? -Infinity) >= -0.1,
      source: measured ? 'measured' : 'partial',
    }
  }

  async normalize(
    input: EngineInput,
    options: NormalizationOptions,
  ): Promise<NormalizationResult> {
    assertAccepts(this, input)
    const filePath = (input as { kind: 'path'; path: string }).path
    const start = Date.now()

    try {
      const bin = await this.requireBinary()
      const before = await this.analyze(input)

      const filter =
        options.method === 'loudness'
          ? // TP=-1.0 is the true peak ceiling recommended by EBU R128 for
            // distribution; LRA=11 is the filter's reference value.
            `loudnorm=I=${options.targetLevel}:TP=-1.0:LRA=11.0`
          : // Peak method: constant gain that brings the peak to the target.
            `volume=${(options.targetLevel - before.peakLevel).toFixed(2)}dB`

      const args = [
        '-nostdin',
        '-hide_banner',
        '-y',
        '-i',
        filePath,
        '-af',
        filter,
      ]

      // TRAP: `loudnorm` works internally at 192 kHz and, unless told
      // otherwise, **writes the output at 192 kHz**. A 44.1 kHz file came
      // back four times heavier and with a sample rate the user never
      // asked for. We enforce the source rate again.
      if (before.sampleRate > 0) args.push('-ar', String(before.sampleRate))

      args.push(options.outputPath)

      const { code, stderr } = await runFfmpeg(bin, args)
      if (code !== 0) {
        throw new Error(
          `ffmpeg è uscito con codice ${code}. ${lastMeaningfulLine(stderr)}`,
        )
      }

      // Real measurement of the result: it is the only honest way to say "finalLoudness".
      const after = await this.measure(options.outputPath)

      const reference =
        options.method === 'peak' ? before.peakLevel : before.lufsIntegrated
      const achieved =
        options.method === 'peak'
          ? after.samplePeak ?? options.targetLevel
          : after.lufsIntegrated ?? options.targetLevel

      return {
        success: true,
        outputPath: options.outputPath,
        gainApplied: Number((achieved - reference).toFixed(2)),
        finalLoudness: Number(
          (after.lufsIntegrated ?? before.lufsIntegrated).toFixed(2),
        ),
        processingTime: Date.now() - start,
      }
    } catch (error) {
      return {
        success: false,
        gainApplied: 0,
        finalLoudness: 0,
        processingTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      }
    }
  }
}

/**
 * Last non-empty line of stderr: when ffmpeg fails, the real reason
 * ("No such file or directory", "Invalid data found...") is almost always there.
 * Better than a generic "process failed" (err-02).
 */
function lastMeaningfulLine(stderr: string): string {
  const lines = stderr.split('\n').map((l) => l.trim()).filter(Boolean)
  return lines[lines.length - 1] ?? ''
}

export function createNativeEngine(): NativeEngine {
  return new NativeEngine()
}
