const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3002

// Initialize Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

console.log('🚀 Starting Audio Normalizer Server...')
console.log(`📍 Environment: ${dev ? 'development' : 'production'}`)
console.log(`📍 Port: ${port}`)

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('Internal server error')
    }
  })
  .listen(port, (err) => {
    if (err) {
      console.error('❌ Server failed to start:', err)
      throw err
    }
    console.log(`✅ Audio Normalizer ready on http://${hostname}:${port}`)
    console.log('🎵 Professional audio normalization server running!')
  })
  .on('error', (err) => {
    console.error('❌ Server error:', err)
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Trying next port...`)
      // Could implement auto port finding here
    }
  })
}).catch((ex) => {
  console.error('❌ Failed to start Next.js app:', ex)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...')
  process.exit(0)
})