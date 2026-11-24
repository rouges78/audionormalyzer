/**
 * Tests on the PROVENANCE of analysis data (task core-03).
 *
 * The point is not "which numbers come out", but that the app never passes off an estimate
 * as a measurement: every AudioAnalysis must declare, via `source`, how much
 * of itself is real. These tests will fail on purpose the day someone
 * reintroduces invented values marking them as measured.
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

/** Loads the service after setting up the mocks of the music-metadata module. */
async function loadProcessor() {
  const { AudioProcessorImpl } = await import('@/services/audio-processor')
  return new AudioProcessorImpl()
}

describe('audio analysis provenance', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(fs.access).mockResolvedValue(undefined)
    vi.mocked(fs.stat).mockResolvedValue({ size: 5_242_880 } as any)
  })

  afterEach(() => {
    vi.doUnmock('music-metadata')
    vi.restoreAllMocks()
  })

  it('uses the REAL container data when the file is readable', async () => {
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

    // These values come from the file, not from a hash of the name
    expect(a.duration).toBe(253.44)
    expect(a.sampleRate).toBe(48000)
    expect(a.channels).toBe(1)
    expect(a.format).toBe('MPEG')
    expect(a.bitrate).toBe(320000)

    // ...but the loudness is NOT measured, and it must say so
    expect(a.source).toBe('partial')
    expect(hasMeasuredLoudness(a)).toBe(false)
  })

  it('falls back to "estimated" if the container cannot be interpreted', async () => {
    vi.doMock('music-metadata', () => ({
      parseFile: vi.fn().mockRejectedValue(new Error('formato non riconosciuto')),
    }))

    const processor = await loadProcessor()
    const a = await processor.analyzeAudio(FILE)

    expect(a.source).toBe('estimated')
    expect(hasMeasuredLoudness(a)).toBe(false)
    // it must still return a structure the UI can use
    expect(a.duration).toBeGreaterThan(0)
    expect(a.sampleRate).toBeGreaterThan(0)
    expect(a.channels).toBeGreaterThanOrEqual(1)
  })

  it('treats a container with missing fields as not interpretable', async () => {
    // missing duration: returning 0 would skew every downstream gain calculation
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

  it('NEVER declares "measured" until there is a real measurement', async () => {
    vi.doMock('music-metadata', () => ({
      parseFile: vi.fn().mockResolvedValue({
        format: { duration: 100, sampleRate: 44100, numberOfChannels: 2, container: 'wav' },
      }),
    }))

    const processor = await loadProcessor()
    const a = await processor.analyzeAudio(FILE)

    // Guard on task core-04: when the native engine really measures via
    // ebur128, this test must be updated DELIBERATELY, not by accident.
    expect(a.source).not.toBe('measured')
  })

  it('keeps the true peak within 0 dBTP', async () => {
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

  it('propagates a clear error if the file does not exist', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))
    const processor = await loadProcessor()
    await expect(processor.analyzeAudio(FILE)).rejects.toThrow('Audio analysis failed')
  })
})
