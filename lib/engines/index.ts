/**
 * Punto d'ingresso dell'astrazione engine.
 *
 * `createAudioEngine()`  → selezione sincrona (euristica sul runtime).
 * `resolveAudioEngine()` → selezione asincrona che, lato server, preferisce
 *                          l'engine nativo se davvero disponibile.
 *
 * Override esplicito: opzione `kind`, oppure variabile d'ambiente
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
  /** Forza un engine specifico, ignorando l'euristica di runtime. */
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
 * Selezione sincrona. Rispetta l'override esplicito/env; altrimenti sceglie
 * per runtime: browser → Web Audio, server → WASM. Non verifica la
 * disponibilità dell'engine nativo (usa `resolveAudioEngine` per quello).
 */
export function createAudioEngine(
  opts: EngineSelectionOptions = {},
): AudioEngine {
  const forced = opts.kind ?? envOverride()
  if (forced) return instantiate(forced)
  return isBrowser() ? createWebAudioEngine() : createWasmEngine()
}

/**
 * Selezione asincrona. Come sopra, ma lato server prova prima l'engine nativo
 * e vi ricade sul WASM solo se il nativo non è disponibile. Se un engine
 * forzato non risulta disponibile, viene comunque restituito (scelta
 * esplicita dell'utente) così l'errore emerge all'uso.
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
