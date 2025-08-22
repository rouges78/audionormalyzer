// TypeScript definitions for @ffmpeg/ffmpeg (web-based FFmpeg)
declare module '@ffmpeg/ffmpeg' {
  export interface FFmpegConfig {
    coreURL?: string
    wasmURL?: string
    workerURL?: string
    log?: boolean
    logger?: (message: LogMessage) => void
  }

  export interface LogMessage {
    type: 'info' | 'error' | 'warning'
    message: string
  }

  export interface ProgressMessage {
    ratio: number
    time: number
  }

  export class FFmpeg {
    constructor(config?: FFmpegConfig)
    
    load(config?: FFmpegConfig): Promise<void>
    isLoaded(): boolean
    
    writeFile(name: string, data: Uint8Array): Promise<void>
    readFile(name: string): Promise<Uint8Array>
    deleteFile(name: string): Promise<void>
    listDir(path: string): Promise<string[]>
    
    exec(args: string[], timeout?: number, progress?: (progress: ProgressMessage) => void): Promise<void>
    
    terminate(): Promise<void>
    
    on(event: 'log', callback: (message: LogMessage) => void): void
    on(event: 'progress', callback: (progress: ProgressMessage) => void): void
    
    off(event: 'log', callback: (message: LogMessage) => void): void
    off(event: 'progress', callback: (progress: ProgressMessage) => void): void
  }
}

declare module '@ffmpeg/util' {
  export function fetchFile(input: string | File | Uint8Array): Promise<Uint8Array>
  export function toBlobURL(url: string, mimeType: string): Promise<string>
}