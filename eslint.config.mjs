import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

/**
 * Configurazione ESLint del progetto (flat config, ESLint 9).
 *
 * Prima di questo file il progetto NON aveva alcun linting: nessuna
 * dipendenza `eslint`, nessuna configurazione, e `next.config.js`
 * silenziava il passo di lint in build con `eslint.ignoreDuringBuilds`.
 * Quel flag resta attivo finché non si decide cosa correggere fra i
 * problemi che questa configurazione fa emergere (vedi qual-13 in
 * ROADMAP.html): toglierlo adesso farebbe fallire ogni build.
 *
 * Il preset è quello ufficiale di Next 15 — `core-web-vitals` per le
 * regole React/Next e `typescript` per quelle TypeScript — senza
 * personalizzazioni: la prima misura va fatta sullo standard, non su
 * una selezione di regole scelta per far tornare i conti.
 */
export default [
  {
    ignores: [
      // Artefatti di build e cartelle di lavoro
      '.next/**',
      'dist/**',
      'out/**',
      'build/**',
      'output/**',
      'temp/**',
      'logs/**',
      'coverage/**',
      'node_modules/**',

      // Materiale archiviato o di scorta, non più in esecuzione
      '_backup/**',
      'electron/legacy/**',

      // Script di build/diagnostica: Node puro, fuori dal perimetro Next
      'scripts/**',

      // File generati
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]
