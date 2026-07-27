"use client"

import { AudioWaveformIcon as Waveform } from "lucide-react"
import { ErrorBoundary } from "@/components/error-boundary"
import { NormalizationWizard } from "@/components/normalization-wizard"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AudioNormalizerApp() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto max-w-4xl px-4 pt-8 pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl p-3 nu-accent" aria-hidden="true">
              <Waveform className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Audio Normalizer
              </h1>
              <p className="text-sm text-muted-foreground">
                Volume uniforme su tutti i tuoi file, senza clipping
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <ErrorBoundary>
          <NormalizationWizard />
        </ErrorBoundary>
      </main>

      <footer className="container mx-auto max-w-4xl px-4 pb-10">
        <p className="text-center text-xs text-muted-foreground">
          Elaborazione locale · conforme EBU R128 · MP3, WAV, FLAC, AAC, M4A, OGG
        </p>
      </footer>
    </div>
  )
}
