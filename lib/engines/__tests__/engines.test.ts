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

describe('AudioEngine — factory di selezione', () => {
  const originalEnv = process.env.AUDIO_ENGINE

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AUDIO_ENGINE
    else process.env.AUDIO_ENGINE = originalEnv
  })

  it('lato server (no window) sceglie il WasmEngine', () => {
    expect(createAudioEngine()).toBeInstanceOf(WasmEngine)
  })

  it('rispetta l\'override esplicito via opzione kind', () => {
    expect(createAudioEngine({ kind: 'web-audio' })).toBeInstanceOf(WebAudioEngine)
    expect(createAudioEngine({ kind: 'native' })).toBeInstanceOf(NativeEngine)
    expect(createAudioEngine({ kind: 'wasm' })).toBeInstanceOf(WasmEngine)
  })

  it('rispetta l\'override via variabile d\'ambiente AUDIO_ENGINE', () => {
    process.env.AUDIO_ENGINE = 'native'
    expect(createAudioEngine()).toBeInstanceOf(NativeEngine)
  })

  it('resolveAudioEngine lato server ricade sul WASM (nativo non disponibile)', async () => {
    const engine = await resolveAudioEngine()
    expect(engine).toBeInstanceOf(WasmEngine)
  })
})

describe('WasmEngine — delega ad AudioProcessor', () => {
  it('analyze delega a processor.analyzeAudio con il path', async () => {
    const proc = fakeProcessor()
    const engine = new WasmEngine(proc)
    const result = await engine.analyze({ kind: 'path', path: '/in/song.wav' })
    expect(proc.analyzeAudio).toHaveBeenCalledWith('/in/song.wav')
    expect(result).toEqual(sampleAnalysis)
  })

  it('normalize restituisce un NormalizationResult ricco con gain calcolato', async () => {
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

  it('normalize cattura gli errori e restituisce success:false', async () => {
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

  it('rifiuta input non supportati (solo path)', async () => {
    const engine = new WasmEngine(fakeProcessor())
    await expect(
      engine.analyze({ kind: 'file', file: {} as File }),
    ).rejects.toBeInstanceOf(UnsupportedInputError)
  })
})

describe('WebAudioEngine — capabilities e vincoli', () => {
  it('non è disponibile in ambiente node (senza window)', () => {
    expect(new WebAudioEngine().isAvailable()).toBe(false)
  })

  it('dichiara di essere solo anteprima e di non misurare LUFS', () => {
    const caps = new WebAudioEngine().capabilities
    expect(caps.previewOnly).toBe(true)
    expect(caps.measuresLufs).toBe(false)
    expect(caps.accepts).toEqual(['file', 'buffer'])
  })

  it('rifiuta la normalizzazione loudness (LUFS non misurabile)', async () => {
    const engine = new WebAudioEngine()
    await expect(
      engine.normalize(
        { kind: 'buffer', data: new ArrayBuffer(8) },
        { method: 'loudness', targetLevel: -16, preserveFormat: false, outputPath: '' },
      ),
    ).rejects.toBeInstanceOf(UnsupportedCapabilityError)
  })
})

describe('NativeEngine — stub', () => {
  it('non è disponibile finché non è implementato (core-04)', async () => {
    expect(await new NativeEngine().isAvailable()).toBe(false)
  })

  it('i metodi sollevano un errore esplicito', async () => {
    const engine = new NativeEngine()
    await expect(engine.analyze({ kind: 'path', path: '/x' })).rejects.toThrow(/core-04/)
  })
})

describe('assertAccepts — helper del contratto', () => {
  it('passa quando l\'input è accettato', () => {
    const engine: AudioEngine = new WasmEngine(fakeProcessor())
    const input: EngineInput = { kind: 'path', path: '/ok' }
    expect(() => assertAccepts(engine, input)).not.toThrow()
  })
})
