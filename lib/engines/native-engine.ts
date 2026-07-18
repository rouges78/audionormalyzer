/**
 * Engine nativo: normalizzazione/analisi tramite ffmpeg nativo (binario su
 * PATH) + il pacchetto `loudness`. È l'engine più veloce e completo, ma
 * disponibile solo lato server/desktop dove esiste un ffmpeg installato.
 *
 * STUB: l'implementazione piena (misura EBU R128 a due passate + true-peak
 * limiting via `loudnorm`) è il task core-04. Per ora l'engine si dichiara
 * non disponibile e i metodi sollevano un errore esplicito, così la factory
 * ricade sull'engine WASM senza sorprese.
 */

import type {
  AudioAnalysis,
  NormalizationOptions,
  NormalizationResult,
} from '@/types/audio'
import {
  AudioEngine,
  EngineCapabilities,
  EngineInput,
  EngineKind,
} from './types'

const NOT_IMPLEMENTED =
  'NativeEngine non ancora implementato (vedi task core-04). Usa l\'engine WASM.'

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

  /**
   * Disponibile solo se: siamo lato server E un ffmpeg nativo è raggiungibile.
   * Finché lo stub non è implementato restituiamo `false` per non essere
   * selezionati dalla factory.
   */
  async isAvailable(): Promise<boolean> {
    if (typeof window !== 'undefined') return false
    // TODO(core-04): verificare la presenza di ffmpeg nativo (es. which/where
    // o ffmpeg-static) e restituire true quando l'implementazione è pronta.
    return false
  }

  async analyze(_input: EngineInput): Promise<AudioAnalysis> {
    throw new Error(NOT_IMPLEMENTED)
  }

  async normalize(
    _input: EngineInput,
    _options: NormalizationOptions,
  ): Promise<NormalizationResult> {
    throw new Error(NOT_IMPLEMENTED)
  }
}

export function createNativeEngine(): NativeEngine {
  return new NativeEngine()
}
