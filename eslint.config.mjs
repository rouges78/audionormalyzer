import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

/**
 * ESLint configuration of the project (flat config, ESLint 9).
 *
 * Before this file the project had NO linting at all: no
 * `eslint` dependency, no configuration, and `next.config.js`
 * silenced the lint step in the build with `eslint.ignoreDuringBuilds`.
 * That flag stays on until it is decided what to fix among the
 * problems this configuration brings up (see qual-13 in
 * ROADMAP.html): removing it now would make every build fail.
 *
 * The preset is the official Next 15 one — `core-web-vitals` for the
 * React/Next rules and `typescript` for the TypeScript ones — without
 * customizations: the first measurement must be made on the standard, not on
 * a selection of rules picked to make the numbers add up.
 */
export default [
  {
    ignores: [
      // Build artifacts and working folders
      '.next/**',
      'dist/**',
      'out/**',
      'build/**',
      'output/**',
      'temp/**',
      'logs/**',
      'coverage/**',
      'node_modules/**',

      // Archived or spare material, no longer running
      '_backup/**',
      'electron/legacy/**',

      // Build/diagnostic scripts: plain Node, outside the Next perimeter
      'scripts/**',

      // Generated files
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]
