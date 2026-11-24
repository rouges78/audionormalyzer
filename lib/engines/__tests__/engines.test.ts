import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AudioAnalysis, AudioProcessor } from '@/types/audio'
import {
  createAudioEngine,
  resolveAudioEngine,
  WasmEngine,
  WebAudioEngine,
  NativeEngine,
  UnsupportedInputError,
  UnsupportedCapabilityError,
  assertAccepts,
  type AudioEngine,
  type EngineInput,
} from '@/lib/engines'
import { parseLoudness } from '@/lib/engines/native-engine'

const sampleAnalysis: AudioAnalysis = {
  duration: 180,
  sampleRate: 44100,
  channels: 2,
  peakLevel: -3,
  rmsLevel: -18,
  lufsIntegrated: -20,
  truePeak: -2.5,
  hasClipping: false,
  format: 'WAV',
}

function fakeProcessor(overrides: Partial<AudioProcessor> = {}): AudioProcessor {
  return {
    analyzeAudio: vi.fn().mockResolvedValue(sampleAnalysis),
    normalizeAudio: vi.fn().mockResolvedValue('/out/normalized.wav'),
    validateFormat: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

describe('AudioEngine — selection factory', () => {
  const originalEnv = process.env.AUDIO_ENGINE

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AUDIO_ENGINE
    else process.env.AUDIO_ENGINE = originalEnv
  })

  it('server side (no window) picks the WasmEngine', () => {
    expect(createAudioEngine()).toBeInstanceOf(WasmEngine)
  })

  it('honors the explicit override via the kind option', () => {
    expect(createAudioEngine({ kind: 'web-audio' })).toBeInstanceOf(WebAudioEngine)
    expect(createAudioEngine({ kind: 'native' })).toBeInstanceOf(NativeEngine)
    expect(createAudioEngine({ kind: 'wasm' })).toBeInstanceOf(WasmEngine)
  })

  it('honors the override via the AUDIO_ENGINE environment variable', () => {
    process.env.AUDIO_ENGINE = 'native'
    expect(createAudioEngine()).toBeInstanceOf(NativeEngine)
  })

  // Before core-04 this test asserted "ALWAYS falls back to WASM", because the
  // native one was a stub that declared itself unavailable. Now the outcome depends
  // on the environment, and that is exactly the intended behavior: the factory must
  // prefer native where ffmpeg exists and fall back to WASM where it does not.
  // Pinning either outcome would make the test green on one machine only.
  it('resolveAudioEngine server side prefers native, or falls back to WASM', async () => {
    const engine = await resolveAudioEngine()
    const ffmpegPresente = await new NativeEngine().isAvailable()
    expect(engine).toBeInstanceOf(ffmpegPresente ? NativeEngine : WasmEngine)
  })
})

describe('WasmEngine — delegates to AudioProcessor', () => {
  it('analyze delegates to processor.analyzeAudio with the path', async () => {
    const proc = fakeProcessor()
    const engine = new WasmEngine(proc)
    const result = await engine.analyze({ kind: 'path', path: '/in/song.wav' })
    expect(proc.analyzeAudio).toHaveBeenCalledWith('/in/song.wav')
    expect(result).toEqual(sampleAnalysis)
  })

  it('normalize returns a rich NormalizationResult with computed gain', async () => {
    const proc = fakeProcessor()
    const engine = new WasmEngine(proc)
    const result = await engine.normalize(
      { kind: 'path', path: '/in/song.wav' },
      { method: 'loudness', targetLevel: -16, preserveFormat: true, outputPath: '/out/normalized.wav' },
    )
    expect(result.success).toBe(true)
    expect(result.outputPath).toBe('/out/normalized.wav')
    // gain = target - lufs = -16 - (-20) = 4
    expect(result.gainApplied).toBeCloseTo(4)
    expect(typeof result.processingTime).toBe('number')
  })

  it('normalize catches errors and returns success:false', async () => {
    const proc = fakeProcessor({
      normalizeAudio: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const engine = new WasmEngine(proc)
    const result = await engine.normalize(
      { kind: 'path', path: '/in/song.wav' },
      { method: 'peak', targetLevel: -1, preserveFormat: true, outputPath: '/out/x.wav' },
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('boom')
  })

  it('rejects unsupported inputs (path only)', async () => {
    const engine = new WasmEngine(fakeProcessor())
    await expect(
      engine.analyze({ kind: 'file', file: {} as File }),
    ).rejects.toBeInstanceOf(UnsupportedInputError)
  })
})

describe('WebAudioEngine — capabilities and constraints', () => {
  it('is not available in a node environment (without window)', () => {
    expect(new WebAudioEngine().isAvailable()).toBe(false)
  })

  it('declares it is preview-only and does not measure LUFS', () => {
    const caps = new WebAudioEngine().capabilities
    expect(caps.previewOnly).toBe(true)
    expect(caps.measuresLufs).toBe(false)
    expect(caps.accepts).toEqual(['file', 'buffer'])
  })

  it('rejects loudness normalization (LUFS not measurable)', async () => {
    const engine = new WebAudioEngine()
    await expect(
      engine.normalize(
        { kind: 'buffer', data: new ArrayBuffer(8) },
        { method: 'loudness', targetLevel: -16, preserveFormat: false, outputPath: '' },
      ),
    ).rejects.toBeInstanceOf(UnsupportedCapabilityError)
  })
})

describe('NativeEngine — contract', () => {
  it('declares it measures LUFS, LRA and true peak', () => {
    const c = new NativeEngine().capabilities
    expect(c.measuresLufs).toBe(true)
    expect(c.measuresLoudnessRange).toBe(true)
    expect(c.truePeakLimiting).toBe(true)
    expect(c.previewOnly).toBe(false)
    expect(c.runtime).toBe('server')
  })

  it('accepts only file paths', async () => {
    const engine = new NativeEngine()
    await expect(
      engine.analyze({ kind: 'buffer', data: new ArrayBuffer(8) }),
    ).rejects.toThrow(/non supporta input di tipo "buffer"/)
  })

  // Availability depends on the environment: here we only check that it is an
  // answer and not an exception. A missing ffmpeg is an expected condition,
  // not an error: it is what lets the factory fall back to WASM.
  it('answers about availability without throwing', async () => {
    expect(typeof (await new NativeEngine().isAvailable())).toBe('boolean')
  })

  it('normalize reports the failure instead of throwing if the file does not exist', async () => {
    const engine = new NativeEngine()
    const res = await engine.normalize(
      { kind: 'path', path: '/percorso/che/non/esiste.wav' },
      { method: 'loudness', targetLevel: -16, preserveFormat: true, outputPath: '/tmp/x.wav' },
    )
    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
  })
})

describe('NativeEngine — parsing ffmpeg output', () => {
  // The ebur128 summary uses the exact same "Peak:" key in two
  // different sections. This sample reproduces it: it is the case that breaks
  // any parsing done by searching for "Peak:" without looking at the section.
  const SUMMARY = `
[Parsed_ebur128_0 @ 0x55] Summary:

  Integrated loudness:
    I:         -27.8 LUFS
    Threshold: -37.8 LUFS

  Loudness range:
    LRA:         3.4 LU
    Threshold: -47.8 LUFS
    LRA low:   -29.1 LUFS
    LRA high:  -25.7 LUFS

  Sample peak:
    Peak:      -24.1 dBFS

  True peak:
    Peak:      -23.6 dBFS
[Parsed_volumedetect_1 @ 0x66] mean_volume: -27.1 dB
[Parsed_volumedetect_1 @ 0x66] max_volume: -24.1 dB
`

  it('tells the sample peak apart from the true peak', () => {
    const m = parseLoudness(SUMMARY)
    expect(m.samplePeak).toBe(-24.1)
    expect(m.truePeak).toBe(-23.6)
  })

  it('extracts integrated loudness, LRA and RMS', () => {
    const m = parseLoudness(SUMMARY)
    expect(m.lufsIntegrated).toBe(-27.8)
    expect(m.loudnessRange).toBe(3.4)
    expect(m.rmsLevel).toBe(-27.1)
  })

  it('treats -inf as a missing measurement instead of returning -Infinity', () => {
    const m = parseLoudness(`
  Integrated loudness:
    I:          -inf LUFS

  Sample peak:
    Peak:       -inf dBFS
`)
    expect(m.lufsIntegrated).toBeUndefined()
    expect(m.samplePeak).toBeUndefined()
  })

  it('does not invent values when ffmpeg produced no summary', () => {
    expect(parseLoudness('Invalid data found when processing input')).toEqual({})
  })
})

describe('assertAccepts — contract helper', () => {
  it('passes when the input is accepted', () => {
    const engine: AudioEngine = new WasmEngine(fakeProcessor())
    const input: EngineInput = { kind: 'path', path: '/ok' }
    expect(() => assertAccepts(engine, input)).not.toThrow()
  })
})
