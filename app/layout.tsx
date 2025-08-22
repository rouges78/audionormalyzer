import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ErrorBoundary } from '@/components/error-boundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Audio Normalizer - Professional Audio Level Normalization',
  description: 'Normalize audio levels with professional peak and loudness normalization. Supports MP3, WAV, FLAC, AAC, M4A, and OGG formats. EBU R128 compliant.',
  keywords: 'audio normalization, loudness normalization, peak normalization, EBU R128, audio processing, LUFS, true peak',
  authors: [{ name: 'Audio Normalizer Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    title: 'Audio Normalizer - Professional Audio Level Normalization',
    description: 'Normalize audio levels with professional peak and loudness normalization. EBU R128 compliant.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Audio Normalizer - Professional Audio Level Normalization',
    description: 'Normalize audio levels with professional peak and loudness normalization. EBU R128 compliant.',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <div className="min-h-screen bg-background">
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
              <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-primary-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-xl font-bold">Audio Normalizer</h1>
                      <p className="text-sm text-muted-foreground">Professional Audio Level Normalization</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="hidden sm:inline">EBU R128 Compliant</span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            </header>
            
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
            
            <footer className="border-t bg-card/50 mt-16">
              <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <h3 className="font-semibold mb-3">Supported Formats</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>MP3 (MPEG Audio Layer 3)</li>
                      <li>WAV (Waveform Audio)</li>
                      <li>FLAC (Free Lossless Audio Codec)</li>
                      <li>AAC (Advanced Audio Coding)</li>
                      <li>M4A (MPEG-4 Audio)</li>
                      <li>OGG (Ogg Vorbis)</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-3">Normalization Methods</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Peak Normalization</li>
                      <li>Loudness Normalization (LUFS)</li>
                      <li>EBU R128 Compliance</li>
                      <li>True Peak Limiting</li>
                      <li>Album Consistency</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-3">Features</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Batch Processing</li>
                      <li>Real-time Preview</li>
                      <li>Metadata Preservation</li>
                      <li>Progress Tracking</li>
                      <li>Quality Preservation</li>
                    </ul>
                  </div>
                </div>
                
                <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
                  <p>&copy; 2024 Audio Normalizer. Professional audio processing tool.</p>
                  <p className="mt-1">Built with Next.js, TypeScript, and FFmpeg</p>
                </div>
              </div>
            </footer>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  )
}