/**
 * Engine WASM: normalizzazione/analisi tramite `@ffmpeg/ffmpeg`.
 *
 * Portabile (browser e server) ma più lento del nativo. Delega alla
 * implementazione esistente `AudioProcessorImpl` per non duplicare la logica
 * ffmpeg, esponendola dietro il contratto comune `AudioEngine`.
 *
 * Accetta input come percorso file (server/desktop). Il supporto a `File`/
 * `buffer` nel browser sarà aggiunto quando servirà (scrittura su FS virtuale
 * di ffmpeg.wasm).
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
    measuresLoudnessRange: false, // loudnorm espone LRA, non ancora estratta qui
    truePeakLimiting: true,
    previewOnly: false,
    accepts: ['path'],
  }

  private processor: AudioProcessor

  constructor(processor: AudioProcessor = createAudioProcessor()) {
    this.processor = processor
  }

  isAvailable(): boolean {
    // ffmpeg.wasm è caricato lazy dal processor; consideriamo l'engine
    // disponibile ovunque, con fallback interni gestiti dal processor.
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

      // Misura reale post-normalizzazione quando possibile.
      let finalLoudness = options.method === 'loudness' ? options.targetLevel : before.lufsIntegrated
      try {
        const after = await this.processor.analyzeAudio(outputPath)
        finalLoudness = after.lufsIntegrated
      } catch {
        // manteniamo la stima se la ri-analisi non è disponibile
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
