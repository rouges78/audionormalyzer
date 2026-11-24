/**
 * WASM engine: normalization/analysis via `@ffmpeg/ffmpeg`.
 *
 * Portable (browser and server) but slower than native. It delegates to the
 * existing `AudioProcessorImpl` implementation so as not to duplicate the ffmpeg
 * logic, exposing it behind the common `AudioEngine` contract.
 *
 * It accepts input as a file path (server/desktop). Support for `File`/
 * `buffer` in the browser will be added when needed (writing to ffmpeg.wasm's
 * virtual FS).
 */

import type { AudioAnalysis, NormalizationResult, NormalizationOptions } from '@/types/audio'
import { createAudioProcessor } from '@/services/audio-processor'
import type { AudioProcessor } from '@/types/audio'
import {
  AudioEngine,
  EngineCapabilities,
  EngineInput,
  EngineKind,
  assertAccepts,
} from './types'

export class WasmEngine implements AudioEngine {
  readonly name = 'ffmpeg-wasm'
  readonly kind: EngineKind = 'wasm'
  readonly capabilities: EngineCapabilities = {
    runtime: 'both',
    measuresLufs: true,
    measuresLoudnessRange: false, // loudnorm exposes LRA, not extracted here yet
    truePeakLimiting: true,
    previewOnly: false,
    accepts: ['path'],
  }

  private processor: AudioProcessor

  constructor(processor: AudioProcessor = createAudioProcessor()) {
    this.processor = processor
  }

  isAvailable(): boolean {
    // ffmpeg.wasm is lazy-loaded by the processor; we consider the engine
    // available everywhere, with internal fallbacks handled by the processor.
    return true
  }

  async analyze(input: EngineInput): Promise<AudioAnalysis> {
    assertAccepts(this, input)
    const path = (input as { kind: 'path'; path: string }).path
    return this.processor.analyzeAudio(path)
  }

  async normalize(
    input: EngineInput,
    options: NormalizationOptions,
  ): Promise<NormalizationResult> {
    assertAccepts(this, input)
    const path = (input as { kind: 'path'; path: string }).path

    const start = Date.now()
    try {
      const before = await this.processor.analyzeAudio(path)
      const outputPath = await this.processor.normalizeAudio(path, options)

      // Real post-normalization measurement when possible.
      let finalLoudness = options.method === 'loudness' ? options.targetLevel : before.lufsIntegrated
      try {
        const after = await this.processor.analyzeAudio(outputPath)
        finalLoudness = after.lufsIntegrated
      } catch {
        // we keep the estimate if re-analysis is not available
      }

      const reference =
        options.method === 'peak' ? before.peakLevel : before.lufsIntegrated
      const gainApplied = options.targetLevel - reference

      return {
        success: true,
        outputPath,
        gainApplied,
        finalLoudness,
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

export function createWasmEngine(processor?: AudioProcessor): WasmEngine {
  return new WasmEngine(processor)
}
