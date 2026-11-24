/**
 * Resolution of the native ffmpeg binary (core-04 / core-05).
 *
 * The native engine needs a real ffmpeg, and "real" means different
 * things depending on where the app runs:
 *
 *   1. development on a machine that already has ffmpeg installed
 *   2. server/container where ffmpeg comes from the package manager
 *   3. distributed Electron executable, where the binary must be bundled
 *
 * Instead of picking one of these three, the module tries them in order of
 * specificity and stops at the first that responds to `-version`. The result is
 * memoized: the search costs a process, and there is no point redoing it for every
 * file.
 *
 * SEARCH ORDER
 *   1. `FFMPEG_PATH`  — explicit override, always takes precedence. Useful
 *                       for those with a special build or who want to force a
 *                       version in tests.
 *   2. `ffmpeg-static` — the binary bundled with the project, if the package is
 *                       installed. It is the desktop executable route.
 *   3. `ffmpeg` on PATH — the system installation.
 *
 * If none responds, `resolveFfmpegPath()` returns `null` and the native engine
 * declares itself unavailable: the factory falls back to WASM without anything
 * blowing up. This is why the module never throws.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** Outcome of the resolution, with the origin for diagnostics and logs. */
export interface FfmpegBinary {
  /** Verified executable path. */
  path: string
  /** Where it comes from: useful in `npm run diagnose` and in error messages. */
  source: 'env' | 'bundled' | 'system'
  /** Version declared by `ffmpeg -version`, e.g. "6.1.1". */
  version: string
}

/**
 * Resolution cache. `undefined` = never searched; `null` = searched and not
 * found. Telling the two cases apart avoids repeating the failed search on every
 * call, which on a queue of 100 tracks would mean 300 useless processes.
 */
let cached: FfmpegBinary | null | undefined

/**
 * The `ffmpeg-static` binary ends up inside `app.asar` when Electron
 * packages the app, and from there it is **not executable**: asar is an archive, not
 * a filesystem. electron-builder extracts it into `app.asar.unpacked`, but the
 * path the package returns keeps pointing inside the archive.
 * The rewrite has to be done by hand — a classic among the "spawn ENOENT" errors
 * that show up only in the executable and never in development.
 */
function unpackedPath(p: string): string {
  return p.includes('app.asar') ? p.replace('app.asar', 'app.asar.unpacked') : p
}

/** Runs `<candidate> -version` and extracts the version, or null if it does not start. */
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
 * Path proposed by `ffmpeg-static`, if the package is installed.
 *
 * `ffmpeg-static` is **deliberately not among the dependencies**: it downloads ~80 MB of
 * binary on every install, which would weigh on every CI `npm ci` for
 * an advantage only the desktop executable needs. The evaluation of that
 * weight hangs on dist-02/dist-07. Until it is decided, the package is
 * optional: if it is there we use it, if not we move on to the system ffmpeg.
 *
 * The specifier lives in a variable and not in the import literal for a
 * practical reason: both TypeScript and webpack would try to resolve a
 * module that normally does not exist, the former with a compile error and the
 * latter trying to bundle it. `webpackIgnore` leaves the import as
 * it is, to be resolved at runtime.
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
 * Looks for a usable ffmpeg. Never throws: it returns `null` when it does not
 * find one, because "ffmpeg missing" is an expected condition (browser,
 * minimal environments) and not an error to propagate.
 */
export async function resolveFfmpeg(): Promise<FfmpegBinary | null> {
  if (cached !== undefined) return cached

  // In the browser there is nothing to look for.
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

/** Convenience: just the path, or null. */
export async function resolveFfmpegPath(): Promise<string | null> {
  return (await resolveFfmpeg())?.path ?? null
}

/**
 * Resets the cache. Needed by the tests, which must be able to simulate different
 * environments in the same process.
 */
export function resetFfmpegCache(): void {
  cached = undefined
}
