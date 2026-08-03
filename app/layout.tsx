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
 * Shell minimo: html + body + provider.
 * L'header vive in app/page.tsx: prima era definito in entrambi i file
 * e la pagina ne mostrava due sovrapposti.
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
            Il Toaster va montato una volta sola, qui: useToast() tiene lo stato
            dei toast in un modulo condiviso, ma senza questo componente nessuno
            lo legge e i toast prodotti da use-error-handling non compaiono a
            schermo. È stato il bug qual-15: ogni errore di upload, validazione
            o analisi veniva registrato e mostrato a nessuno.
          */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
