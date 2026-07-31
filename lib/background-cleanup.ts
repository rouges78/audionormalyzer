/**
 * Timer di manutenzione in background.
 *
 * Diversi moduli (storage in memoria, download manager, rate limiter)
 * registrano un `setInterval` al momento dell'import per fare pulizia
 * periodica. Fatto ingenuamente questo ha due effetti indesiderati:
 *
 *  1. il timer tiene vivo l'event loop di Node anche quando non resta altro
 *     da fare — è la ragione per cui `vitest run` non terminava mai e andava
 *     ucciso a mano (task test-08);
 *  2. in un test ogni import fa partire un timer che nessuno spegne.
 *
 * `scheduleBackgroundCleanup` centralizza il comportamento corretto:
 * non registra nulla in ambiente di test o lato browser, e marca il timer
 * come `unref` così Node può uscire liberamente.
 */

export type BackgroundCleanupTask = () => void | Promise<void>

/** Vero quando siamo lato server e non dentro una run di test. */
function shouldSchedule(): boolean {
  if (typeof window !== 'undefined') return false // solo lato server
  if (process.env.NODE_ENV === 'test') return false // Vitest imposta NODE_ENV=test
  if (process.env.VITEST) return false // cintura e bretelle
  return true
}

/**
 * Registra una pulizia periodica che non impedisce al processo di terminare.
 *
 * @param task Funzione da eseguire a ogni tick; se rigetta, l'errore viene
 *             loggato e ignorato — una pulizia fallita non deve far cadere il server.
 * @param intervalMs Intervallo in millisecondi.
 * @returns Il timer registrato, oppure null se non è stato registrato nulla.
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
          console.error('Errore nella pulizia periodica:', error)
        })
      }
    } catch (error) {
      console.error('Errore nella pulizia periodica:', error)
    }
  }, intervalMs)

  // unref esiste su Node ma non in tutti i runtime (es. edge runtime).
  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  return timer
}
