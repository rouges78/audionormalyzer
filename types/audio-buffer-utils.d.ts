// Type definitions for audio-buffer-utils library

declare module 'audio-buffer-utils' {
  // AudioBuffer utility functions
  export function create(
    channels: number | number[][],
    length?: number,
    sampleRate?: number
  ): AudioBuffer

  export function copy(
    buffer: AudioBuffer,
    target?: AudioBuffer,
    targetOffset?: number,
    sourceOffset?: number,
    sourceEnd?: number
  ): AudioBuffer

  export function shallow(buffer: AudioBuffer): AudioBuffer

  export function clone(buffer: AudioBuffer): AudioBuffer

  export function reverse(buffer: AudioBuffer, target?: AudioBuffer): AudioBuffer

  export function invert(buffer: AudioBuffer, target?: AudioBuffer): AudioBuffer

  export function zero(buffer: AudioBuffer, target?: AudioBuffer): AudioBuffer

  export function noise(buffer: AudioBuffer, target?: AudioBuffer): AudioBuffer

  export function equal(bufferA: AudioBuffer, bufferB: AudioBuffer): boolean

  export function fill(
    buffer: AudioBuffer,
    value: number | ((sample: number, channel: number, offset: number) => number),
    target?: AudioBuffer,
    start?: number,
    end?: number
  ): AudioBuffer

  export function slice(
    buffer: AudioBuffer,
    start?: number,
    end?: number,
    target?: AudioBuffer
  ): AudioBuffer

  export function subbuffer(
    buffer: AudioBuffer,
    start?: number,
    end?: number
  ): AudioBuffer

  export function pad(
    buffer: AudioBuffer,
    length: number,
    value?: number
  ): AudioBuffer

  export function padLeft(
    buffer: AudioBuffer,
    length: number,
    value?: number
  ): AudioBuffer

  export function padRight(
    buffer: AudioBuffer,
    length: number,
    value?: number
  ): AudioBuffer

  export function rotate(
    buffer: AudioBuffer,
    offset: number,
    target?: AudioBuffer
  ): AudioBuffer

  export function shift(
    buffer: AudioBuffer,
    offset: number,
    target?: AudioBuffer
  ): AudioBuffer

  export function normalize(
    buffer: AudioBuffer,
    target?: AudioBuffer,
    start?: number,
    end?: number
  ): AudioBuffer

  export function removeStatic(
    buffer: AudioBuffer,
    target?: AudioBuffer
  ): AudioBuffer

  export function trim(buffer: AudioBuffer, level?: number): AudioBuffer

  export function trimLeft(buffer: AudioBuffer, level?: number): AudioBuffer

  export function trimRight(buffer: AudioBuffer, level?: number): AudioBuffer

  export function mix(
    bufferA: AudioBuffer,
    bufferB: AudioBuffer,
    ratio?: number,
    offset?: number
  ): AudioBuffer

  export function size(buffer: AudioBuffer): number

  export function data(
    buffer: AudioBuffer,
    data?: Float32Array[] | Float32Array
  ): Float32Array[]
}