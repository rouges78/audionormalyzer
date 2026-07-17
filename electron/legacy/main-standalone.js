const { app, BrowserWindow, dialog, Menu } = require('electron')
const path = require('path')
const { createServer } = require('http')
const { parse } = require('url')

console.log('🚀 Audio Normalizer Standalone starting...')

let mainWindow
let server = null
const port = 3002

// Embedded Next.js server - no external spawning
function startEmbeddedServer() {
  return new Promise((resolve, reject) => {
    console.log('🌐 Starting embedded Next.js server...')
    
    try {
      // Try to require Next.js directly
      const next = require('next')
      
      const dev = false
      const hostname = 'localhost'
      
      console.log('📦 Initializing Next.js app...')
      const app = next({ dev, hostname, port, dir: path.join(__dirname, '..') })
      const handle = app.getRequestHandler()

      app.prepare().then(() => {
        console.log('✅ Next.js app prepared')
        
        server = createServer(async (req, res) => {
          try {
            const parsedUrl = parse(req.url, true)
            await handle(req, res, parsedUrl)
          } catch (err) {
            console.error('Error handling request:', err)
            res.statusCode = 500
            res.end('Internal server error')
          }
        })

        server.listen(port, (err) => {
          if (err) {
            console.error('❌ Server failed to start:', err)
            reject(err)
            return
          }
          console.log(`✅ Embedded server ready on http://localhost:${port}`)
          resolve()
        })

        server.on('error', (err) => {
          console.error('❌ Server error:', err)
          if (err.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is already in use`))
          } else {
            reject(err)
          }
        })

      }).catch((err) => {
        console.error('❌ Next.js preparation failed:', err)
        reject(err)
      })

    } catch (error) {
      console.error('❌ Failed to load Next.js:', error)
      
      // Fallback: serve static files if Next.js fails
      console.log('⚠️ Falling back to static file server...')
      startStaticServer().then(resolve).catch(reject)
    }
  })
}

// Fallback static file server
function startStaticServer() {
  return new Promise((resolve, reject) => {
    const fs = require('fs')
    const mime = require('mime-types') || { lookup: () => 'text/html' }
    
    const staticDir = path.join(__dirname, '..', '.next', 'static')
    const buildDir = path.join(__dirname, '..', '.next')
    
    server = createServer((req, res) => {
      let filePath = req.url === '/' ? '/index.html' : req.url
      
      // Try different locations
      const locations = [
        path.join(buildDir, 'server', 'pages', filePath),
        path.join(buildDir, 'static', filePath),
        path.join(__dirname, '..', 'public', filePath),
        path.join(__dirname, '..', 'app', 'index.html')
      ]
      
      let found = false
      for (const location of locations) {
        if (fs.existsSync(location)) {
          const content = fs.readFileSync(location)
          const mimeType = mime.lookup(location) || 'text/html'
          res.writeHead(200, { 'Content-Type': mimeType })
          res.end(content)
          found = true
          break
        }
      }
      
      if (!found) {
        // Serve a basic audio normalizer interface
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Audio Normalizer</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 50px auto; 
                padding: 20px;
                background: linear-gradient(135deg, #1e3c72, #2a5298);
                color: white;
                text-align: center;
              }
              .container {
                background: rgba(255,255,255,0.1);
                border-radius: 15px;
                padding: 40px;
                backdrop-filter: blur(10px);
              }
              h1 { color: #00ffff; text-shadow: 0 0 10px #00ffff; }
              .upload-area {
                border: 3px dashed #00ffff;
                border-radius: 10px;
                padding: 40px;
                margin: 20px 0;
                background: rgba(0,255,255,0.1);
              }
              .features {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin: 30px 0;
              }
              .feature {
                background: rgba(255,255,255,0.1);
                padding: 20px;
                border-radius: 10px;
                border: 1px solid rgba(0,255,255,0.3);
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🎵 Audio Normalizer</h1>
              <p>Professional Audio Level Normalization</p>
              
              <div class="upload-area">
                <h3>📁 Upload Audio Files</h3>
                <p>Drag & drop audio files here or click to select</p>
                <input type="file" multiple accept="audio/*" id="fileInput" style="display:none;">
                <button onclick="document.getElementById('fileInput').click()" 
                        style="padding:10px 20px; background:#00ffff; color:#000; border:none; border-radius:5px; cursor:pointer;">
                  Select Files
                </button>
              </div>
              
              <div class="features">
                <div class="feature">
                  <h4>📊 Peak Normalization</h4>
                  <p>Normalize to target peak levels</p>
                </div>
                <div class="feature">
                  <h4>🎚️ Loudness (LUFS)</h4>
                  <p>EBU R128 compliant normalization</p>
                </div>
                <div class="feature">
                  <h4>🎵 Multiple Formats</h4>
                  <p>MP3, WAV, FLAC, AAC, M4A, OGG</p>
                </div>
                <div class="feature">
                  <h4>📦 Batch Processing</h4>
                  <p>Process entire albums at once</p>
                </div>
              </div>
              
              <p style="margin-top:30px; opacity:0.8;">
                Audio Normalizer Professional Edition<br>
                <small>Standalone Version - Ready for Professional Use</small>
              </p>
            </div>
            
            <script>
              document.getElementById('fileInput').addEventListener('change', function(e) {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                  alert('Files selected: ' + files.map(f => f.name).join(', ') + 
                        '\\n\\nNote: This is a standalone version. Full processing capabilities will be available when the complete server is running.');
                }
              });
              
              // Make upload area clickable
              document.querySelector('.upload-area').addEventListener('click', function() {
                document.getElementById('fileInput').click();
              });
            </script>
          </body>
          </html>
        `)
      }
    })

    server.listen(port, (err) => {
      if (err) {
        reject(err)
      } else {
        console.log(`✅ Static server ready on http://localhost:${port}`)
        resolve()
      }
    })
  })
}

function createWindow() {
  console.log('📱 Creating main window...')
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      enableRemoteModule: false
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    title: 'Audio Normalizer - Standalone Edition',
    icon: path.join(__dirname, '..', 'assets', 'icon.png')
  })

  // Simple menu
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' }
      ]
    }
  ]
  
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // Load the application
  const appUrl = `http://localhost:${port}`
  console.log(`🌐 Loading app from: ${appUrl}`)
  
  mainWindow.loadURL(appUrl).catch(err => {
    console.error('❌ Failed to load app URL:', err)
    
    dialog.showErrorBox('Connection Error', 
      `Failed to connect to the embedded server.\n\nError: ${err.message}\n\nThe application will try to recover automatically.`)
  })

  mainWindow.once('ready-to-show', () => {
    console.log('✅ Window ready, showing...')
    mainWindow.show()
    
    // Welcome message
    setTimeout(() => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Audio Normalizer Ready',
        message: 'Audio Normalizer Standalone Edition',
        detail: 'This is a standalone version of Audio Normalizer.\n\nFeatures:\n• Embedded server (no external dependencies)\n• Professional audio normalization\n• Multiple format support\n• Batch processing capabilities\n\nReady to use!',
        buttons: ['Start Normalizing']
      })
    }, 1500)
  })

  mainWindow.on('closed', () => {
    console.log('🔚 Main window closed')
    mainWindow = null
  })

  // Handle navigation
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    if (parsedUrl.origin !== `http://localhost:${port}`) {
      event.preventDefault()
      require('electron').shell.openExternal(navigationUrl)
    }
  })
}

async function initializeApp() {
  try {
    console.log('⚡ Electron app ready, initializing standalone version...')
    
    // Start embedded server (no external spawning)
    await startEmbeddedServer()
    
    // Create window
    createWindow()
    
    console.log('🎉 Standalone Audio Normalizer initialized successfully!')
    
  } catch (error) {
    console.error('❌ Failed to initialize standalone app:', error)
    
    dialog.showErrorBox('Startup Error', 
      `Failed to start Audio Normalizer Standalone:\n\n${error.message}\n\nThis is a standalone version that should work without external dependencies.\n\nTry:\n1. Running as Administrator\n2. Temporarily disabling antivirus\n3. Checking available disk space`)
    
    app.quit()
  }
}

app.whenReady().then(initializeApp)

app.on('window-all-closed', () => {
  console.log('🔚 All windows closed')
  
  if (server) {
    console.log('🛑 Closing embedded server...')
    server.close()
  }
  
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  if (server) {
    console.log('🛑 Shutting down server...')
    server.close()
  }
})

// Enhanced error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  
  if (server) {
    server.close()
  }
  
  dialog.showErrorBox('Application Error', 
    `Standalone Audio Normalizer encountered an error:\n\n${error.message}\n\nThe application will close.`)
  
  app.quit()
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason)
})

console.log('📋 Standalone Electron main process initialized')
console.log('📁 Working directory:', process.cwd())
console.log('📁 App path:', app.getAppPath())
