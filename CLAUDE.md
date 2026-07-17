# CLAUDE.md

Project conventions for AI coding agents. Behavioral guidelines (Karpathy) live in the global `~/.claude/CLAUDE.md`.

## Project

Audio Normalizer — Next.js web app + Electron desktop wrapper for audio normalization (ffmpeg-based). Radix UI + Tailwind, Vitest for tests, Docker support.

## Build & test

- Dev web: `npm run dev` · Dev desktop: `npm run electron:dev`
- Build web: `npm run build`
- Desktop exe: `npm run build:exe:quick` (portable win x64) · full: `npm run build:desktop`
- Tests: `npm test` (Vitest) · unit/integration/api: `npm run test:unit` / `test:integration` / `test:api`
- Lint: `npm run lint`
- Clean temp audio: `npm run clean:temp`
- Docker: `npm run docker:build` / `docker:dev` / `docker:prod`

## Notes

- Many legacy `build:*` scripts exist from past build troubleshooting — prefer `build:exe:quick` or `build:desktop`; don't add new build variants.
- Audio env setup: `npm run setup:audio`; diagnose issues with `npm run diagnose`.
