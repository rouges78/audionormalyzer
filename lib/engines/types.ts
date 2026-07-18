/**
 * Astrazione "engine" pluggabile per il processing audio.
 *
 * Separa la logica di elaborazione dal resto dell'app dietro un contratto
 * comune (`AudioEngine`), così da poter scegliere a runtime tra:
 *   - WASM (`@ffmpeg/ffmpeg`)   → browser e server, portabile
 *   - nativo (ffmpeg su PATH)   → solo server/desktop, veloce e completo
 *   - Web Audio                 → solo browser, anteprima basata sul gain
 *
 * I tipi di dominio (AudioAnalysis / NormalizationOptions / NormalizationResult)
 * restano la fonte unica in `@/types/audio`: ogni engine li implementa.
 */

import type {
  AudioAnalysis,
  NormalizationOptions,
  NormalizationResult,
} from '@/types/audio'

/** Runtime/tecnologia con cui un engine esegue il processing. */
export type EngineKind = 'wasm' | 'native' | 'web-audio'

/**
 * Sorgente audio astratta, indipendente dall'ambiente:
 *  - `path`   → percorso su filesystem (server/desktop)
 *  - `file`   → oggetto `File` del browser
 *  - `buffer` → dati grezzi in memoria (browser o server)
 * Ogni engine dichiara in `capabilities.accepts` quali forme accetta.
 */
export type EngineInput =
  | { kind: 'path'; path: string }
  | { kind: 'file'; file: File }
  | { kind: 'buffer'; data: ArrayBuffer; fileName?: string }

export type EngineInputKind = EngineInput['kind']

/** Descrive cosa un engine sa (e non sa) fare: usato per selezione e UI. */
export interface EngineCapabilities {
  /** Ambienti in cui l'engine è utilizzabile. */
  runtime: 'browser' | 'server' | 'both'
  /** Misura la LUFS integrata reale (EBU R128). */
  measuresLufs: boolean
  /** Misura il Loudness Range reale (EBU R128 LRA). */
  measuresLoudnessRange: boolean
  /** Applica true-peak limiting reale in fase di normalizzazione. */
  truePeakLimiting: boolean
  /**
   * L'output è solo un'anteprima approssimata (guadagno costante), non una
   * normalizzazione definitiva conforme allo standard.
   */
  previewOnly: boolean
  /** Forme di `EngineInput` accettate da questo engine. */
  accepts: EngineInputKind[]
}

/**
 * Contratto comune a tutti gli engine di processing audio.
 * Un'implementazione DEVE essere sicura da istanziare anche quando non è
 * utilizzabile nel runtime corrente: la disponibilità va verificata con
 * `isAvailable()` prima dell'uso.
 */
export interface AudioEngine {
  /** Nome leggibile, es. "ffmpeg-wasm". */
  readonly name: string
  readonly kind: EngineKind
  readonly capabilities: EngineCapabilities

  /** Verifica se l'engine è utilizzabile nel runtime corrente. */
  isAvailable(): boolean | Promise<boolean>

  /** Analizza l'audio ed estrae i metadati/misure disponibili. */
  analyze(input: EngineInput): Promise<AudioAnalysis>

  /** Normalizza l'audio secondo le opzioni e restituisce l'esito. */
  normalize(
    input: EngineInput,
    options: NormalizationOptions,
  ): Promise<NormalizationResult>
}

/** Errore sollevato quando un engine riceve un input che non supporta. */
export class UnsupportedInputError extends Error {
  constructor(engine: string, got: EngineInputKind, accepts: EngineInputKind[]) {
    super(
      `L'engine "${engine}" non supporta input di tipo "${got}". ` +
        `Accetta: ${accepts.join(', ')}.`,
    )
    this.name = 'UnsupportedInputError'
  }
}

/** Errore sollevato quando una capability richiesta non è disponibile. */
export class UnsupportedCapabilityError extends Error {
  constructor(engine: string, capability: string) {
    super(`L'engine "${engine}" non supporta: ${capability}.`)
    this.name = 'UnsupportedCapabilityError'
  }
}

/** Verifica che un input sia tra quelli accettati, altrimenti solleva. */
export function assertAccepts(
  engine: AudioEngine,
  input: EngineInput,
): void {
  if (!engine.capabilities.accepts.includes(input.kind)) {
    throw new UnsupportedInputError(
      engine.name,
      input.kind,
      engine.capabilities.accepts,
    )
  }
}
