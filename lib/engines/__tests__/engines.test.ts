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

  // Prima di core-04 questo test affermava "ricade SEMPRE sul WASM", perché il
  // nativo era uno stub che si dichiarava indisponibile. Ora l'esito dipende
  // dall'ambiente, ed è esattamente il comportamento voluto: la factory deve
  // preferire il nativo dove c'è ffmpeg e ripiegare sul WASM dove non c'è.
  // Fissare uno dei due esiti renderebbe il test verde solo su una macchina.
  it('resolveAudioEngine lato server preferisce il nativo, o ricade sul WASM', async () => {
    const engine = await resolveAudioEngine()
    const ffmpegPresente = await new NativeEngine().isAvailable()
    expect(engine).toBeInstanceOf(ffmpegPresente ? NativeEngine : WasmEngine)
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

describe('NativeEngine — contratto', () => {
  it('dichiara di misurare LUFS, LRA e true peak', () => {
    const c = new NativeEngine().capabilities
    expect(c.measuresLufs).toBe(true)
    expect(c.measuresLoudnessRange).toBe(true)
    expect(c.truePeakLimiting).toBe(true)
    expect(c.previewOnly).toBe(false)
    expect(c.runtime).toBe('server')
  })

  it('accetta solo percorsi file', async () => {
    const engine = new NativeEngine()
    await expect(
      engine.analyze({ kind: 'buffer', data: new ArrayBuffer(8) }),
    ).rejects.toThrow(/non supporta input di tipo "buffer"/)
  })

  // La disponibilità dipende dall'ambiente: qui verifichiamo solo che sia una
  // risposta e non un'eccezione. Un ffmpeg assente è una condizione prevista,
  // non un errore: è ciò che permette alla factory di ripiegare sul WASM.
  it('risponde sulla disponibilità senza sollevare', async () => {
    expect(typeof (await new NativeEngine().isAvailable())).toBe('boolean')
  })

  it('normalize riporta il fallimento invece di sollevare, se il file non esiste', async () => {
    const engine = new NativeEngine()
    const res = await engine.normalize(
      { kind: 'path', path: '/percorso/che/non/esiste.wav' },
      { method: 'loudness', targetLevel: -16, preserveFormat: true, outputPath: '/tmp/x.wav' },
    )
    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
  })
})

describe('NativeEngine — parsing dell\'output di ffmpeg', () => {
  // Il riepilogo di ebur128 usa la stessa identica chiave "Peak:" in due
  // sezioni diverse. Questo campione lo riproduce: è il caso che rompe
  // qualunque parsing fatto cercando "Peak:" senza guardare la sezione.
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

  it('distingue il sample peak dal true peak', () => {
    const m = parseLoudness(SUMMARY)
    expect(m.samplePeak).toBe(-24.1)
    expect(m.truePeak).toBe(-23.6)
  })

  it('estrae loudness integrata, LRA e RMS', () => {
    const m = parseLoudness(SUMMARY)
    expect(m.lufsIntegrated).toBe(-27.8)
    expect(m.loudnessRange).toBe(3.4)
    expect(m.rmsLevel).toBe(-27.1)
  })

  it('tratta -inf come misura assente invece di restituire -Infinity', () => {
    const m = parseLoudness(`
  Integrated loudness:
    I:          -inf LUFS

  Sample peak:
    Peak:       -inf dBFS
`)
    expect(m.lufsIntegrated).toBeUndefined()
    expect(m.samplePeak).toBeUndefined()
  })

  it('non inventa valori quando ffmpeg non ha prodotto un riepilogo', () => {
    expect(parseLoudness('Invalid data found when processing input')).toEqual({})
  })
})

describe('assertAccepts — helper del contratto', () => {
  it('passa quando l\'input è accettato', () => {
    const engine: AudioEngine = new WasmEngine(fakeProcessor())
    const input: EngineInput = { kind: 'path', path: '/ok' }
    expect(() => assertAccepts(engine, input)).not.toThrow()
  })
})
