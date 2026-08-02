/** @type {import('next').NextConfig} */
const nextConfig = {
  // NON aggiungere qui `typescript: { ignoreBuildErrors: true }`.
  // Era una toppa per i 30 errori TypeScript sanati con qual-07: ora
  // `npx tsc --noEmit` e pulito, .next/types compresi, e il build deve
  // tornare a fallire se qualcuno reintroduce un errore di tipi.
  //
  // `eslint.ignoreDuringBuilds` resta finche non c'e un ESLint da
  // eseguire: nel progetto non ci sono ne la dipendenza ne una
  // configurazione, quindi togliendolo il build si fermerebbe a chiedere
  // di installare ESLint. Vedi qual-13 in ROADMAP.html.
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'loudness'],
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    }
    return config
  },
}

module.exports = nextConfig