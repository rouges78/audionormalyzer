const { app, BrowserWindow, dialog, Menu } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')

console.log('🚀 Audio Normalizer Desktop starting...')

let mainWindow
let nextServer = null
const port = 3002

// Check if .next directory exists
function checkBuildExists() {
  const nextDir = path.join(__dirname, '..', '.next')
  const packageJson = path.join(__dirname, '..', 'package.json')
  
  if (!fs.existsSync(nextDir)) {
    console.error('❌ .next directory not found. App not built properly.')
    dialog.showErrorBox('Build Error', 
      'The application was not built properly.\n\nMissing .next directory.\n\nPlease run "npm run build" and rebuild the executable.')
    app.quit()
    return false
  }
  
  if (!fs.existsSync(packageJson)) {
    console.error('❌ package.json not found.')
    dialog.showErrorBox('Build Error', 'Missing package.json file.')
    app.quit()
    return false
  }
  
  console.log('✅ Build files verified')
  return true
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    console.log('🌐 Starting Next.js server...')
    
    // Try different approaches to start the server
    const nextPath = path.join(__dirname, '..', 'node_modules', '.bin', 'next')
    const serverPath = path.join(__dirname, '..', 'server.js')
    const projectPath = path.join(__dirname, '..')
    
    // Try server.js first if it exists
    let command, args
    if (fs.existsSync(serverPath)) {
      command = 'node'
      args = [serverPath]
      console.log('📄 Using custom server.js')
    } else {
      command = 'node'
      args = [nextPath, 'start', '-p', port]
      console.log('📦 Using next start')
    }
    
    nextServer = spawn(command, args, {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        NODE_ENV: 'production',
        PORT: port
      }
    })

    let serverReady = false
    let startupTimeout
    
    nextServer.stdout.on('data', (data) => {
      const output = data.toString()
      console.log('Next.js:', output)
      
      if (output.includes('Ready in') || 
          output.includes('started server') || 
          output.includes('Local:') ||
          output.includes(`http://localhost:${port}`)) {
        if (!serverReady) {
          serverReady = true
          console.log('✅ Next.js server ready')
          clearTimeout(startupTimeout)
          setTimeout(resolve, 1000)
        }
      }
    })

    nextServer.stderr.on('data', (data) => {
      const error = data.toString()
      console.error('Next.js Error:', error)
      
      // Check for common errors
      if (error.includes('ENOENT') || error.includes('spawn')) {
        console.error('❌ Failed to spawn Next.js process')
        if (!serverReady) {
          clearTimeout(startupTimeout)
          reject(new Error('Failed to start Next.js server: Process spawn error'))
        }
      }
    })

    nextServer.on('close', (code) => {
      console.log(`Next.js server exited with code ${code}`)
      nextServer = null
      if (code !== 0 && !serverReady) {
        reject(new Error(`Next.js server exited with code ${code}`))
      }
    })

    nextServer.on('error', (error) => {
      console.error('Failed to start Next.js server:', error)
      if (!serverReady) {
        clearTimeout(startupTimeout)
        reject(error)
      }
    })

    // Extended timeout with fallback
    startupTimeout = setTimeout(() => {
      if (!serverReady) {
        console.log('⚠️ Next.js server startup timeout, attempting fallback...')
        
        // Try to check if port is listening
        const net = require('net')
        const client = new net.Socket()
        
        client.setTimeout(2000)
        client.on('connect', () => {
          console.log('✅ Port is responsive, proceeding...')
          client.destroy()
          serverReady = true
          resolve()
        })
        
        client.on('timeout', () => {
          console.log('❌ Port check timeout')
          client.destroy()
          reject(new Error('Next.js server failed to start within timeout'))
        })
        
        client.on('error', () => {
          console.log('❌ Port not responsive')
          client.destroy()
          reject(new Error('Next.js server not responding'))
        })
        
        client.connect(port, 'localhost')
      }
    }, 20000) // 20 second timeout
  })
}

function createWindow() {
  console.log('📱 Creating main window...')
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      enableRemoteModule: false
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true, // Hide menu bar by default
    title: 'Audio Normalizer - Professional Edition',
    icon: path.join(__dirname, '..', 'assets', 'icon.png') // Add icon if available
  })

  // Set up menu
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
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]
  
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // Load the Next.js app
  const appUrl = `http://localhost:${port}`
  console.log(`🌐 Loading app from: ${appUrl}`)
  
  mainWindow.loadURL(appUrl).catch(err => {
    console.error('❌ Failed to load app URL:', err)
    
    dialog.showErrorBox('Connection Error', 
      `Failed to connect to the Audio Normalizer server.\n\nURL: ${appUrl}\nError: ${err.message}\n\nPlease ensure the application is properly built and try restarting.`)
  })

  mainWindow.once('ready-to-show', () => {
    console.log('✅ Window ready, showing...')
    mainWindow.show()
    
    // Optional welcome message
    if (process.env.NODE_ENV !== 'development') {
      setTimeout(() => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Audio Normalizer Ready',
          message: 'Welcome to Audio Normalizer Professional Edition!',
          detail: 'This desktop application provides professional audio normalization with EBU R128 compliance.\n\nFeatures:\n• Peak & Loudness Normalization\n• Batch Processing\n• Multiple Audio Formats\n• Professional Analysis\n\nDrag and drop audio files to get started!',
          buttons: ['Get Started']
        })
      }, 2000)
    }
  })

  mainWindow.on('closed', () => {
    console.log('🔚 Main window closed')
    mainWindow = null
  })

  // Handle navigation securely
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    
    if (parsedUrl.origin !== `http://localhost:${port}`) {
      event.preventDefault()
      require('electron').shell.openExternal(navigationUrl)
    }
  })

  // Handle new window requests
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url)
    return { action: 'deny' }
  })
}

async function initializeApp() {
  try {
    console.log('⚡ Electron app ready, initializing...')
    
    // Check build files first
    if (!checkBuildExists()) {
      return
    }
    
    // Start Next.js server
    await startNextServer()
    
    // Create the window
    createWindow()
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error)
    
    dialog.showErrorBox('Startup Error', 
      `Failed to start Audio Normalizer:\n\n${error.message}\n\nTroubleshooting:\n1. Ensure you have run "npm run build" first\n2. Check that Node.js is properly installed\n3. Try running as Administrator\n4. Check antivirus settings`)
    
    app.quit()
  }
}

app.whenReady().then(initializeApp)

app.on('window-all-closed', () => {
  console.log('🔚 All windows closed')
  
  // Kill Next.js server gracefully
  if (nextServer) {
    console.log('🛑 Stopping Next.js server...')
    nextServer.kill('SIGTERM')
    
    setTimeout(() => {
      if (nextServer && !nextServer.killed) {
        console.log('🛑 Force killing Next.js server...')
        nextServer.kill('SIGKILL')
      }
    }, 3000)
  }
  
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log('🔄 Reactivating, creating window...')
    createWindow()
  }
})

app.on('before-quit', () => {
  if (nextServer) {
    console.log('🛑 Killing Next.js server before quit...')
    nextServer.kill('SIGTERM')
  }
})

// Enhanced error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  
  if (nextServer) {
    nextServer.kill('SIGKILL')
  }
  
  dialog.showErrorBox('Application Error', 
    `An unexpected error occurred:\n\n${error.message}\n\nStack:\n${error.stack}\n\nThe application will now close.`)
  
  app.quit()
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

console.log('📋 Electron main process initialized')
console.log('📁 Working directory:', process.cwd())
console.log('📁 App path:', app.getAppPath())