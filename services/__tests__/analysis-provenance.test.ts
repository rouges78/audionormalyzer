/**
 * Test sulla PROVENIENZA dei dati di analisi (task core-03).
 *
 * Il punto non è "che numeri escono", ma che l'app non spacci mai una stima
 * per una misura: ogni AudioAnalysis deve dichiarare, tramite `source`, quanto
 * di sé è reale. Questi test falliranno di proposito il giorno in cui qualcuno
 * reintrodurrà valori inventati marcandoli come misurati.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { hasMeasuredLoudness } from '@/types/audio'

vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  },
  constants: { R_OK: 4, W_OK: 2 },
}))

const FILE = '/test/track.mp3'

/** Carica il servizio dopo aver impostato i mock del modulo music-metadata. */
async function loadProcessor() {
  const { AudioProcessorImpl } = await import('@/services/audio-processor')
  return new AudioProcessorImpl()
}

describe('provenienza dell\'analisi audio', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(fs.access).mockResolvedValue(undefined)
    vi.mocked(fs.stat).mockResolvedValue({ size: 5_242_880 } as any)
  })

  afterEach(() => {
    vi.doUnmock('music-metadata')
    vi.restoreAllMocks()
  })

  it('usa i dati REALI del contenitore quando il file è leggibile', async () => {
    vi.doMock('music-metadata', () => ({
      parseFile: vi.fn().mockResolvedValue({
        format: {
          duration: 253.44,
          sampleRate: 48000,
          numberOfChannels: 1,
          container: 'mpeg',
          bitrate: 320000,
        },
      }),
    }))

    const processor = await loadProcessor()
    const a = await processor.analyzeAudio(FILE)

    // Questi valori vengono dal file, non da un hash del nome
    expect(a.duration).toBe(253.44)
    expect(a.sampleRate).toBe(48000)
    expect(a.channels).toBe(1)
    expect(a.format).toBe('MPEG')
    expect(a.bitrate).toBe(320000)

    // ...ma la loudness NON è misurata, e deve dirlo
    expect(a.source).toBe('partial')
    expect(hasMeasuredLoudness(a)).toBe(false)
  })

  it('ripiega su "estimated" se il contenitore non è interpretabile', async () => {
    vi.doMock('music-metadata', () => ({
      parseFile: vi.fn().mockRejectedValue(new Error('formato non riconosciuto')),
    }))

    const processor = await loadProcessor()
    const a = await processor.analyzeAudio(FILE)

    expect(a.source).toBe('estimated')
    expect(hasMeasuredLoudness(a)).toBe(false)
    // deve comunque restituire una struttura utilizzabile dalla UI
    expect(a.duration).toBeGreaterThan(0)
    expect(a.sampleRate).toBeGreaterThan(0)
    expect(a.channels).toBeGreaterThanOrEqual(1)
  })

  it('tratta come non interpretabile un contenitore con campi mancanti', async () => {
    // durata assente: restituire 0 falserebbe ogni calcolo di guadagno a valle
    vi.doMock('music-metadata', () => ({
      parseFile: vi.fn().mockResolvedValue({
        format: { sampleRate: 44100, numberOfChannels: 2 },
      }),
    }))

    const processor = await loadProcessor()
    const a = await processor.analyzeAudio(FILE)

    expect(a.source).toBe('estimated')
    expect(a.duration).toBeGreaterThan(0)
  })

  it('non dichiara MAI "measured" finché non c\'è una misura vera', async () => {
    vi.doMock('music-metadata', () => ({
      parseFile: vi.fn().mockResolvedValue({
        format: { duration: 100, sampleRate: 44100, numberOfChannels: 2, container: 'wav' },
      }),
    }))

    const processor = await loadProcessor()
    const a = await processor.analyzeAudio(FILE)

    // Guardia sul task core-04: quando l'engine nativo misurerà davvero via
    // ebur128, questo test andrà aggiornato DELIBERATAMENTE, non per caso.
    expect(a.source).not.toBe('measured')
  })

  it('mantiene il true peak entro 0 dBTP', async () => {
    vi.doMock('music-metadata', () => ({
      parseFile: vi.fn().mockResolvedValue({
        format: { duration: 100, sampleRate: 44100, numberOfChannels: 2, container: 'wav' },
      }),
    }))

    const processor = await loadProcessor()
    const a = await processor.analyzeAudio(FILE)

    expect(a.truePeak).toBeLessThanOrEqual(0)
    expect(a.rmsLevel).toBeLessThan(a.peakLevel)
  })

  it('propaga un errore chiaro se il file non esiste', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))
    const processor = await loadProcessor()
    await expect(processor.analyzeAudio(FILE)).rejects.toThrow('Audio analysis failed')
  })
})
