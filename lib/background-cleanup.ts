/**
 * Background maintenance timers.
 *
 * Several modules (in-memory storage, download manager, rate limiter)
 * register a `setInterval` at import time to do periodic
 * cleanup. Done naively this has two unwanted effects:
 *
 *  1. the timer keeps Node's event loop alive even when nothing else is left
 *     to do — it is the reason `vitest run` never terminated and had to be
 *     killed by hand (task test-08);
 *  2. in a test every import starts a timer that nobody stops.
 *
 * `scheduleBackgroundCleanup` centralizes the correct behavior:
 * it registers nothing in the test environment or in the browser, and marks the timer
 * as `unref` so Node can exit freely.
 */

export type BackgroundCleanupTask = () => void | Promise<void>

/** True when we are server-side and not inside a test run. */
function shouldSchedule(): boolean {
  if (typeof window !== 'undefined') return false // server-side only
  if (process.env.NODE_ENV === 'test') return false // Vitest sets NODE_ENV=test
  if (process.env.VITEST) return false // belt and braces
  return true
}

/**
 * Registers a periodic cleanup that does not prevent the process from exiting.
 *
 * @param task Function to run on every tick; if it rejects, the error is
 *             logged and ignored — a failed cleanup must not bring the server down.
 * @param intervalMs Interval in milliseconds.
 * @returns The registered timer, or null if nothing was registered.
 */
export function scheduleBackgroundCleanup(
  task: BackgroundCleanupTask,
  intervalMs: number
): NodeJS.Timeout | null {
  if (!shouldSchedule()) return null

  const timer = setInterval(() => {
    try {
      const result = task()
      if (result instanceof Promise) {
        result.catch((error) => {
          console.error('Periodic cleanup error:', error)
        })
      }
    } catch (error) {
      console.error('Periodic cleanup error:', error)
    }
  }, intervalMs)

  // unref exists on Node but not in every runtime (e.g. edge runtime).
  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  return timer
}
