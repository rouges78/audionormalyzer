/**
 * Entry point of the engine abstraction.
 *
 * `createAudioEngine()`  → synchronous selection (runtime heuristic).
 * `resolveAudioEngine()` → asynchronous selection that, server side, prefers
 *                          the native engine if it is really available.
 *
 * Explicit override: the `kind` option, or the environment variable
 * `AUDIO_ENGINE` = "wasm" | "native" | "web-audio".
 */

import type { AudioEngine, EngineKind } from './types'
import { WasmEngine, createWasmEngine } from './wasm-engine'
import { WebAudioEngine, createWebAudioEngine } from './web-audio-engine'
import { NativeEngine, createNativeEngine } from './native-engine'

export * from './types'
export { WasmEngine, createWasmEngine } from './wasm-engine'
export { WebAudioEngine, createWebAudioEngine } from './web-audio-engine'
export { NativeEngine, createNativeEngine } from './native-engine'

export interface EngineSelectionOptions {
  /** Forces a specific engine, ignoring the runtime heuristic. */
  kind?: EngineKind
}

const isBrowser = (): boolean => typeof window !== 'undefined'

function envOverride(): EngineKind | undefined {
  const raw =
    typeof process !== 'undefined' ? process.env?.AUDIO_ENGINE : undefined
  if (raw === 'wasm' || raw === 'native' || raw === 'web-audio') return raw
  return undefined
}

function instantiate(kind: EngineKind): AudioEngine {
  switch (kind) {
    case 'native':
      return createNativeEngine()
    case 'web-audio':
      return createWebAudioEngine()
    case 'wasm':
    default:
      return createWasmEngine()
  }
}

/**
 * Synchronous selection. Honors the explicit/env override; otherwise it picks
 * by runtime: browser → Web Audio, server → WASM. It does not check the
 * availability of the native engine (use `resolveAudioEngine` for that).
 */
export function createAudioEngine(
  opts: EngineSelectionOptions = {},
): AudioEngine {
  const forced = opts.kind ?? envOverride()
  if (forced) return instantiate(forced)
  return isBrowser() ? createWebAudioEngine() : createWasmEngine()
}

/**
 * Asynchronous selection. As above, but server side it tries the native engine first
 * and falls back to WASM only if native is not available. If a
 * forced engine turns out to be unavailable, it is returned anyway (an explicit
 * user choice) so the error surfaces on use.
 */
export async function resolveAudioEngine(
  opts: EngineSelectionOptions = {},
): Promise<AudioEngine> {
  const forced = opts.kind ?? envOverride()
  if (forced) return instantiate(forced)

  if (isBrowser()) return createWebAudioEngine()

  const native = createNativeEngine()
  if (await native.isAvailable()) return native
  return createWasmEngine()
}
