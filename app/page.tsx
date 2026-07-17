"use client"

import { AudioWaveformIcon as Waveform } from "lucide-react"
import { ErrorBoundary } from "@/components/error-boundary"
import { NormalizationWizard } from "@/components/normalization-wizard"

export default function AudioNormalizerApp() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-800 rounded-lg">
              <Waveform className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">AudioNorm Pro</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Elevate Your Sound with Precision</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <ErrorBoundary>
          <NormalizationWizard />
        </ErrorBoundary>
      </main>
    </div>
  )
}
