/**
 * Pluggable "engine" abstraction for audio processing.
 *
 * Separates the processing logic from the rest of the app behind a common
 * contract (`AudioEngine`), so we can choose at runtime between:
 *   - WASM (`@ffmpeg/ffmpeg`)   → browser and server, portable
 *   - native (ffmpeg on PATH)   → server/desktop only, fast and complete
 *   - Web Audio                 → browser only, gain-based preview
 *
 * The domain types (AudioAnalysis / NormalizationOptions / NormalizationResult)
 * remain the single source in `@/types/audio`: every engine implements them.
 */

import type {
  AudioAnalysis,
  NormalizationOptions,
  NormalizationResult,
} from '@/types/audio'

/** Runtime/technology an engine uses to run processing. */
export type EngineKind = 'wasm' | 'native' | 'web-audio'

/**
 * Abstract audio source, independent of the environment:
 *  - `path`   → filesystem path (server/desktop)
 *  - `file`   → browser `File` object
 *  - `buffer` → raw in-memory data (browser or server)
 * Each engine declares in `capabilities.accepts` which forms it accepts.
 */
export type EngineInput =
  | { kind: 'path'; path: string }
  | { kind: 'file'; file: File }
  | { kind: 'buffer'; data: ArrayBuffer; fileName?: string }

export type EngineInputKind = EngineInput['kind']

/** Describes what an engine can (and cannot) do: used for selection and UI. */
export interface EngineCapabilities {
  /** Environments where the engine can be used. */
  runtime: 'browser' | 'server' | 'both'
  /** Measures the real integrated LUFS (EBU R128). */
  measuresLufs: boolean
  /** Measures the real Loudness Range (EBU R128 LRA). */
  measuresLoudnessRange: boolean
  /** Applies real true-peak limiting during normalization. */
  truePeakLimiting: boolean
  /**
   * The output is only an approximate preview (constant gain), not a
   * final standard-compliant normalization.
   */
  previewOnly: boolean
  /** `EngineInput` forms accepted by this engine. */
  accepts: EngineInputKind[]
}

/**
 * Contract common to all audio processing engines.
 * An implementation MUST be safe to instantiate even when it is not
 * usable in the current runtime: availability must be checked with
 * `isAvailable()` before use.
 */
export interface AudioEngine {
  /** Human-readable name, e.g. "ffmpeg-wasm". */
  readonly name: string
  readonly kind: EngineKind
  readonly capabilities: EngineCapabilities

  /** Checks whether the engine is usable in the current runtime. */
  isAvailable(): boolean | Promise<boolean>

  /** Analyzes the audio and extracts the available metadata/measurements. */
  analyze(input: EngineInput): Promise<AudioAnalysis>

  /** Normalizes the audio according to the options and returns the outcome. */
  normalize(
    input: EngineInput,
    options: NormalizationOptions,
  ): Promise<NormalizationResult>
}

/** Error raised when an engine receives an input it does not support. */
export class UnsupportedInputError extends Error {
  constructor(engine: string, got: EngineInputKind, accepts: EngineInputKind[]) {
    super(
      `L'engine "${engine}" non supporta input di tipo "${got}". ` +
        `Accetta: ${accepts.join(', ')}.`,
    )
    this.name = 'UnsupportedInputError'
  }
}

/** Error raised when a required capability is not available. */
export class UnsupportedCapabilityError extends Error {
  constructor(engine: string, capability: string) {
    super(`L'engine "${engine}" non supporta: ${capability}.`)
    this.name = 'UnsupportedCapabilityError'
  }
}

/** Checks that an input is among the accepted ones, otherwise throws. */
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
