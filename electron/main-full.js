const { app, BrowserWindow, dialog, Menu } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')

console.log('🚀 Audio Normalizer - Full Version Starting...')

let mainWindow
let serverProcess
let serverReady = false

function startNextServer() {
  console.log('🔧 Starting Next.js server...')
  
  return new Promise((resolve, reject) => {
    // Check if server.js exists
    const serverPath = path.join(__dirname, '..', 'server.js')
    if (!fs.existsSync(serverPath)) {
      console.log('❌ server.js not found, creating minimal server...')
      createMinimalServer()
    }

    // Start the server
    serverProcess = spawn('node', [serverPath], {
      env: { 
        ...process.env, 
        PORT: '3001',
        NODE_ENV: 'production'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let serverOutput = ''

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString()
      serverOutput += output
      console.log('📤 Server:', output.trim())
      
      if (output.includes('Ready on') || output.includes('started server')) {
        console.log('✅ Next.js server is ready!')
        serverReady = true
        resolve()
      }
    })

    serverProcess.stderr.on('data', (data) => {
      const error = data.toString()
      console.log('📤 Server Error:', error.trim())
      
      // Don't reject on warnings, only on critical errors
      if (error.includes('EADDRINUSE') || error.includes('Cannot find module')) {
        reject(new Error(error))
      }
    })

    serverProcess.on('error', (error) => {
      console.log('❌ Server process error:', error.message)
      reject(error)
    })

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        console.log('⚠️  Server timeout, proceeding anyway...')
        resolve() // Don't reject, try to continue
      }
    }, 30000)
  })
}

function createMinimalServer() {
  const serverContent = `
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = false
const hostname = 'localhost'
const port = process.env.PORT || 3001

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
  .once('error', (err) => {
    console.error(err)
    process.exit(1)
  })
  .listen(port, () => {
    console.log(\`> Ready on http://\${hostname}:\${port}\`)
  })
})
`
  
  fs.writeFileSync(path.join(__dirname, '..', 'server.js'), serverContent)
  console.log('✅ Created minimal server.js')
}

function createWindow() {
  console.log('📱 Creating main window...')
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    titleBarStyle: 'default'
  })

  // Create application menu
  createMenu()

  // Show loading screen first
  showLoadingScreen()

  // Start server and then load the app
  startNextServer()
    .then(() => {
      console.log('🌐 Loading Next.js application...')
      
      // Wait a bit more for the server to be fully ready
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:3001')
        
        mainWindow.webContents.once('did-finish-load', () => {
          console.log('✅ Application loaded successfully')
          mainWindow.show()
        })

        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
          console.log('❌ Failed to load app:', errorDescription)
          showErrorScreen(errorDescription)
        })

      }, 3000)
    })
    .catch((error) => {
      console.log('❌ Server failed to start:', error.message)
      showErrorScreen(error.message)
    })

  mainWindow.on('closed', () => {
    console.log('🔚 Main window closed')
    if (serverProcess) {
      serverProcess.kill()
    }
    mainWindow = null
  })
}

function showLoadingScreen() {
  const loadingHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Audio Normalizer - Loading</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }
        .container {
            text-align: center;
            background: rgba(255,255,255,0.1);
            padding: 60px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        h1 { font-size: 2.5em; margin-bottom: 20px; }
        .loading {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
            margin: 30px auto;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .status { margin-top: 20px; opacity: 0.8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎵 Audio Normalizer</h1>
        <div class="loading"></div>
        <div class="status">Starting Next.js server...</div>
        <div style="margin-top: 20px; font-size: 14px; opacity: 0.7;">
            Please wait while we load the application
        </div>
    </div>
</body>
</html>`

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(loadingHTML))
}

function showErrorScreen(error) {
  const errorHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Audio Normalizer - Error</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }
        .container {
            text-align: center;
            background: rgba(255,255,255,0.1);
            padding: 60px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            max-width: 600px;
        }
        h1 { font-size: 2.5em; margin-bottom: 20px; }
        .error { 
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            font-family: monospace;
            font-size: 14px;
        }
        button {
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 15px 30px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        button:hover { background: rgba(255,255,255,0.3); }
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ Startup Error</h1>
        <div class="error">${error}</div>
        <div style="margin: 20px 0;">
            <p>The Next.js server failed to start.</p>
            <p>This might be due to:</p>
            <ul style="text-align: left; display: inline-block;">
                <li>Missing dependencies</li>
                <li>Port already in use</li>
                <li>Build files not found</li>
            </ul>
        </div>
        <button onclick="location.reload()">Retry</button>
        <button onclick="window.close()">Close</button>
    </div>
</body>
</html>`

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorHTML))
  mainWindow.show()
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Audio Files',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            // This would trigger file selection in the web app
            mainWindow.webContents.send('menu-open-files')
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Audio Normalizer',
              message: 'Audio Normalizer v1.0',
              detail: 'Professional audio level normalization tool\n\nBuilt with Electron and Next.js'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// App event handlers
app.whenReady().then(() => {
  console.log('⚡ Electron app ready')
  createWindow()
})

app.on('window-all-closed', () => {
  console.log('🔚 All windows closed')
  if (serverProcess) {
    serverProcess.kill()
  }
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

console.log('📋 Electron main process initialized')