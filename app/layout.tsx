import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ErrorBoundary } from '@/components/error-boundary'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Audio Normalizer — Normalizzazione audio professionale',
  description:
    'Normalizza il volume dei tuoi file audio con normalizzazione di picco e di loudness. Supporta MP3, WAV, FLAC, AAC, M4A e OGG. Conforme EBU R128.',
  keywords:
    'normalizzazione audio, loudness, normalizzazione di picco, EBU R128, elaborazione audio, LUFS, true peak',
  authors: [{ name: 'Audio Normalizer' }],
  robots: 'index, follow',
  openGraph: {
    title: 'Audio Normalizer — Normalizzazione audio professionale',
    description: 'Normalizza il volume dei tuoi file audio. Conforme EBU R128.',
    type: 'website',
    locale: 'it_IT',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Audio Normalizer — Normalizzazione audio professionale',
    description: 'Normalizza il volume dei tuoi file audio. Conforme EBU R128.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e6e9ef' },
    { media: '(prefers-color-scheme: dark)', color: '#23273a' },
  ],
}

/**
 * Minimal shell: html + body + providers.
 * The header lives in app/page.tsx: it used to be defined in both files
 * and the page showed two of them on top of each other.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>{children}</ErrorBoundary>
          {/*
            The Toaster must be mounted exactly once, here: useToast() keeps the
            toast state in a shared module, but without this component nobody
            reads it and the toasts produced by use-error-handling never show up
            on screen. That was bug qual-15: every upload, validation
            or analysis error was recorded and shown to nobody.
          */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
