/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do NOT add `typescript: { ignoreBuildErrors: true }` here.
  // It was a patch for the 30 TypeScript errors fixed with qual-07: now
  // `npx tsc --noEmit` is clean, .next/types included, and the build must
  // fail again if someone reintroduces a type error.
  //
  // `eslint.ignoreDuringBuilds` stays until there is an ESLint to
  // run: the project has neither the dependency nor a
  // configuration, so removing it would stop the build to ask
  // to install ESLint. See qual-13 in ROADMAP.html.
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