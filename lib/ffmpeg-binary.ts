/**
 * Risoluzione del binario ffmpeg nativo (core-04 / core-05).
 *
 * L'engine nativo ha bisogno di un ffmpeg vero, e "vero" significa cose
 * diverse a seconda di dove gira l'app:
 *
 *   1. sviluppo su una macchina che ha già ffmpeg installato
 *   2. server/container dove ffmpeg arriva dal package manager
 *   3. eseguibile Electron distribuito, dove il binario va bundlato
 *
 * Invece di scegliere una di queste tre, il modulo le prova in ordine di
 * specificità e si ferma alla prima che risponde a `-version`. Il risultato è
 * memorizzato: la ricerca costa un processo, e non ha senso rifarla a ogni
 * file.
 *
 * ORDINE DI RICERCA
 *   1. `FFMPEG_PATH`  — override esplicito, ha sempre la precedenza. Serve a
 *                       chi ha una build particolare o vuole forzare una
 *                       versione in test.
 *   2. `ffmpeg-static` — il binario bundlato col progetto, se il pacchetto è
 *                       installato. È la via dell'eseguibile desktop.
 *   3. `ffmpeg` su PATH — l'installazione di sistema.
 *
 * Se nessuna risponde, `resolveFfmpegPath()` restituisce `null` e l'engine
 * nativo si dichiara non disponibile: la factory ricade sul WASM senza che
 * nulla esploda. Questo è il motivo per cui il modulo non solleva mai.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** Esito della risoluzione, con la provenienza per diagnostica e log. */
export interface FfmpegBinary {
  /** Percorso eseguibile verificato. */
  path: string
  /** Da dove arriva: utile in `npm run diagnose` e nei messaggi d'errore. */
  source: 'env' | 'bundled' | 'system'
  /** Versione dichiarata da `ffmpeg -version`, es. "6.1.1". */
  version: string
}

/**
 * Cache della risoluzione. `undefined` = mai cercato; `null` = cercato e non
 * trovato. Distinguere i due casi evita di ripetere la ricerca fallita a ogni
 * chiamata, che su una coda di 100 tracce vorrebbe dire 300 processi inutili.
 */
let cached: FfmpegBinary | null | undefined

/**
 * Il binario di `ffmpeg-static` finisce dentro `app.asar` quando Electron
 * impacchetta l'app, e da lì **non è eseguibile**: l'asar è un archivio, non
 * un filesystem. electron-builder lo estrae in `app.asar.unpacked`, ma il
 * percorso che il pacchetto restituisce continua a puntare dentro l'archivio.
 * La riscrittura va fatta a mano — è un classico degli errori "spawn ENOENT"
 * che si vedono solo nell'eseguibile e mai in sviluppo.
 */
function unpackedPath(p: string): string {
  return p.includes('app.asar') ? p.replace('app.asar', 'app.asar.unpacked') : p
}

/** Esegue `<candidate> -version` ed estrae la versione, o null se non parte. */
async function probe(candidate: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(candidate, ['-version'], {
      timeout: 10_000,
      windowsHide: true,
    })
    const m = stdout.match(/ffmpeg version (\S+)/i)
    return m ? m[1] : 'sconosciuta'
  } catch {
    return null
  }
}

/**
 * Percorso proposto da `ffmpeg-static`, se il pacchetto è installato.
 *
 * `ffmpeg-static` è **volutamente non fra le dipendenze**: scarica ~80 MB di
 * binario a ogni installazione, il che peserebbe su ogni `npm ci` della CI per
 * un vantaggio che serve solo all'eseguibile desktop. La valutazione su quel
 * peso è appesa a dist-02/dist-07. Finché non è decisa, il pacchetto è
 * opzionale: se c'è lo usiamo, se non c'è si passa all'ffmpeg di sistema.
 *
 * Lo specificatore sta in una variabile e non nel letterale dell'import per un
 * motivo pratico: sia TypeScript sia webpack proverebbero a risolvere un
 * modulo che di norma non esiste, il primo con un errore di compilazione e il
 * secondo tentando di impacchettarlo. `webpackIgnore` lascia l'import così
 * com'è, da risolvere a runtime.
 */
async function bundledCandidate(): Promise<string | null> {
  try {
    const spec = 'ffmpeg-static'
    const mod: unknown = await import(/* webpackIgnore: true */ spec)
    const p = (mod as { default?: unknown }).default ?? mod
    return typeof p === 'string' && p.length > 0 ? unpackedPath(p) : null
  } catch {
    return null
  }
}

/**
 * Cerca un ffmpeg utilizzabile. Non solleva mai: restituisce `null` quando non
 * ne trova uno, perché "ffmpeg assente" è una condizione prevista (browser,
 * ambienti minimali) e non un errore da propagare.
 */
export async function resolveFfmpeg(): Promise<FfmpegBinary | null> {
  if (cached !== undefined) return cached

  // Nel browser non c'è nulla da cercare.
  if (typeof window !== 'undefined') {
    cached = null
    return null
  }

  const candidates: Array<{ path: string; source: FfmpegBinary['source'] }> = []

  const fromEnv = process.env.FFMPEG_PATH?.trim()
  if (fromEnv) candidates.push({ path: fromEnv, source: 'env' })

  const bundled = await bundledCandidate()
  if (bundled) candidates.push({ path: bundled, source: 'bundled' })

  candidates.push({ path: 'ffmpeg', source: 'system' })

  for (const c of candidates) {
    const version = await probe(c.path)
    if (version) {
      cached = { path: c.path, source: c.source, version }
      return cached
    }
  }

  cached = null
  return null
}

/** Comodità: solo il percorso, o null. */
export async function resolveFfmpegPath(): Promise<string | null> {
  return (await resolveFfmpeg())?.path ?? null
}

/**
 * Azzera la cache. Serve ai test, che devono poter simulare ambienti diversi
 * nello stesso processo.
 */
export function resetFfmpegCache(): void {
  cached = undefined
}
