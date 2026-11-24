/**
 * EBU R128 conformance on REAL audio files (test-02).
 *
 * Until now the suite covered normalization only with mocks: it checked
 * that ffmpeg was invoked with certain arguments, never that the output file
 * had the requested loudness. Those are two different questions, and the second is
 * the only one that matters to whoever uses the program.
 *
 * Here the files are generated with ffmpeg, normalized by the NativeEngine and then
 * **measured again**: the assertion is on the result, not on the command.
 *
 * TWO CHOICES THAT NEED JUSTIFYING
 *
 * 1. The tests skip themselves if ffmpeg is missing. A red in that case would
 *    say nothing about the code, it would only say the machine has no ffmpeg —
 *    and that is the normal condition in which the app falls back to the WASM engine.
 *
 * 2. The temporary files live in `os.tmpdir()` and not under the project
 *    folder. On the working folder mounted via FUSE `unlink()` is forbidden
 *    and every cleanup fails with EPERM (test-09): writing elsewhere is the
 *    simplest way not to skew the measurement.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { NativeEngine } from '@/lib/engines/native-engine'
import { resolveFfmpegPath } from '@/lib/ffmpeg-binary'

const execFileAsync = promisify(execFile)

let workDir = ''
let ffmpeg: string | null = null

/**
 * Tolerance on the loudness target, in LU.
 *
 * EBU R128 allows ±0.5 LU on programme loudness, but that tolerance
 * applies to the measurement, not to a single-pass correction. Single-pass
 * `loudnorm` estimates and corrects together, so on real material it deviates
 * a bit more. 1.0 LU is tight enough to expose a real error
 * (a wrong sign, an ignored target) and loose enough not to
 * flash red with every ffmpeg version. Two-pass, which
 * would allow tightening it, is core-09.
 */
const TOLLERANZA_LU = 1.0

/** Generates a test file with ffmpeg. */
async function genera(
  nome: string,
  opts: { freq: number; durata: number; gainDb: number; rate?: number; canali?: number },
): Promise<string> {
  const out = path.join(workDir, nome)
  const rate = opts.rate ?? 44100
  await execFileAsync(ffmpeg!, [
    '-nostdin', '-hide_banner', '-y',
    '-f', 'lavfi',
    '-i', `sine=frequency=${opts.freq}:duration=${opts.durata}:sample_rate=${rate}`,
    '-ac', String(opts.canali ?? 2),
    '-af', `volume=${opts.gainDb}dB`,
    '-c:a', 'pcm_s16le',
    out,
  ])
  return out
}

beforeAll(async () => {
  ffmpeg = await resolveFfmpegPath()
  if (!ffmpeg) return
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'an-conformity-'))
}, 60_000)

afterAll(async () => {
  if (workDir) await fs.rm(workDir, { recursive: true, force: true })
})

// `describe.skipIf` evaluates the condition at test collection time, when
// beforeAll has not run yet: availability would then have to be rechecked
// inside the tests. Instead we use a flag computed here, synchronously.
const senzaFfmpeg = () => ffmpeg === null

describe('EBU R128 conformance on real files (test-02)', () => {
  it('measures a plausible loudness instead of an invented value', async () => {
    if (senzaFfmpeg()) return
    const src = await genera('misura.wav', { freq: 440, durata: 6, gainDb: -8 })
    const engine = new NativeEngine()
    const a = await engine.analyze({ kind: 'path', path: src })

    // A sine at -8 dB sits well below zero: if the value were a
    // placeholder (0, fixed -23, NaN) this check would catch it.
    expect(a.lufsIntegrated).toBeLessThan(-5)
    expect(a.lufsIntegrated).toBeGreaterThan(-40)
    expect(a.source).toBe('measured')

    // The true peak cannot be below the sample peak: if parsing had
    // confused the two same-named sections of the summary, it would show here.
    expect(a.truePeak).toBeGreaterThanOrEqual(a.peakLevel - 0.1)

    expect(a.sampleRate).toBe(44100)
    expect(a.channels).toBe(2)
    expect(a.duration).toBeGreaterThan(5)
  }, 60_000)

  it.each([-23, -16, -14])(
    'normalizza a %i LUFS entro la tolleranza',
    async (target) => {
      if (senzaFfmpeg()) return
      const src = await genera(`src${Math.abs(target)}.wav`, {
        freq: 440, durata: 6, gainDb: -8,
      })
      const out = path.join(workDir, `out${Math.abs(target)}.wav`)
      const engine = new NativeEngine()

      const res = await engine.normalize(
        { kind: 'path', path: src },
        { method: 'loudness', targetLevel: target, preserveFormat: true, outputPath: out },
      )
      expect(res.success).toBe(true)

      // The check that matters: measuring the produced file again.
      const dopo = await engine.analyze({ kind: 'path', path: out })
      expect(Math.abs(dopo.lufsIntegrated - target)).toBeLessThanOrEqual(TOLLERANZA_LU)

      // `finalLoudness` must be the real measurement, not the target copied back.
      expect(Math.abs(res.finalLoudness - dopo.lufsIntegrated)).toBeLessThan(0.5)
    },
    120_000,
  )

  it('does not exceed the -1 dBTP true peak ceiling', async () => {
    if (senzaFfmpeg()) return
    // Source almost clipping: without limiting the true peak would break through.
    const src = await genera('forte.wav', { freq: 440, durata: 6, gainDb: -0.5 })
    const out = path.join(workDir, 'forte-out.wav')
    const engine = new NativeEngine()

    const res = await engine.normalize(
      { kind: 'path', path: src },
      { method: 'loudness', targetLevel: -14, preserveFormat: true, outputPath: out },
    )
    expect(res.success).toBe(true)

    const dopo = await engine.analyze({ kind: 'path', path: out })
    // 0.5 dB margin: the loudnorm limiter works on the estimated true peak.
    expect(dopo.truePeak).toBeLessThanOrEqual(-0.5)
  }, 120_000)

  it('keeps the original sample rate instead of rewriting it at 192 kHz', async () => {
    if (senzaFfmpeg()) return
    // This is the test that guards against a real `loudnorm` trap: the
    // filter works internally at 192 kHz and, without an explicit `-ar`,
    // writes the output at that rate. The file came back weighing four
    // times as much, with a sample rate nobody had asked for.
    const src = await genera('rate.wav', { freq: 440, durata: 4, gainDb: -10, rate: 44100 })
    const out = path.join(workDir, 'rate-out.wav')
    const engine = new NativeEngine()

    const res = await engine.normalize(
      { kind: 'path', path: src },
      { method: 'loudness', targetLevel: -16, preserveFormat: true, outputPath: out },
    )
    expect(res.success).toBe(true)

    const dopo = await engine.analyze({ kind: 'path', path: out })
    expect(dopo.sampleRate).toBe(44100)
    expect(dopo.channels).toBe(2)
  }, 120_000)

  it('with the peak method brings the peak to the requested level', async () => {
    if (senzaFfmpeg()) return
    const src = await genera('peak.wav', { freq: 440, durata: 4, gainDb: -12 })
    const out = path.join(workDir, 'peak-out.wav')
    const engine = new NativeEngine()

    const res = await engine.normalize(
      { kind: 'path', path: src },
      { method: 'peak', targetLevel: -3, preserveFormat: true, outputPath: out },
    )
    expect(res.success).toBe(true)

    const dopo = await engine.analyze({ kind: 'path', path: out })
    expect(Math.abs(dopo.peakLevel - -3)).toBeLessThanOrEqual(0.5)
  }, 120_000)

  it('reports a readable error on unreadable files, without throwing', async () => {
    if (senzaFfmpeg()) return
    const rotto = path.join(workDir, 'rotto.wav')
    await fs.writeFile(rotto, 'questo non è audio')
    const engine = new NativeEngine()

    const res = await engine.normalize(
      { kind: 'path', path: rotto },
      { method: 'loudness', targetLevel: -16, preserveFormat: true, outputPath: path.join(workDir, 'mai.wav') },
    )
    expect(res.success).toBe(false)
    // The message must say something, not be an empty string (err-02).
    expect(res.error && res.error.length).toBeGreaterThan(10)
  }, 60_000)
})
