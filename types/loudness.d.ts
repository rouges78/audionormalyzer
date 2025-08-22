// Type definitions for loudness library

declare module 'loudness' {
  interface LoudnessOptions {
    integrated?: boolean
    range?: boolean
    peak?: boolean
    truePeak?: boolean
  }

  interface LoudnessResult {
    input_i?: number // Integrated loudness (LUFS)
    input_lra?: number // Loudness range (LU)
    input_tp?: number // True peak (dBTP)
    input_thresh?: number // Threshold (LUFS)
    target_offset?: number // Target offset (LU)
  }

  interface LoudnessAnalysis {
    integrated: number // LUFS
    range: number // LU
    peak: number // dBFS
    truePeak: number // dBTP
  }

  // Main loudness analysis function
  export function loudness(
    input: string,
    options?: LoudnessOptions,
    callback?: (err: Error | null, result: LoudnessResult) => void
  ): Promise<LoudnessResult>

  // Synchronous version
  export function loudnessSync(
    input: string,
    options?: LoudnessOptions
  ): LoudnessResult

  // Utility functions
  export function normalize(
    input: string,
    output: string,
    target: number,
    callback?: (err: Error | null) => void
  ): Promise<void>

  export function normalizeSync(
    input: string,
    output: string,
    target: number
  ): void

  // Peak analysis
  export function peak(
    input: string,
    callback?: (err: Error | null, peak: number) => void
  ): Promise<number>

  export function peakSync(input: string): number
}