const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')

console.log('🚀 Audio Normalizer starting...')

let mainWindow

function createWindow() {
  console.log('📱 Creating main window...')
  
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      },
      icon: path.join(__dirname, '..', 'assets', 'icon.png')
    })

    // Load a simple test page first
    const testHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Audio Normalizer</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            background: rgba(255,255,255,0.1);
            padding: 60px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        h1 { 
            font-size: 3em; 
            margin-bottom: 20px;
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle {
            font-size: 1.2em;
            margin-bottom: 40px;
            opacity: 0.9;
        }
        .status {
            background: rgba(76, 175, 80, 0.2);
            border: 1px solid rgba(76, 175, 80, 0.5);
            padding: 20px;
            border-radius: 10px;
            margin: 30px 0;
        }
        .buttons {
            margin-top: 30px;
        }
        button {
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 15px 30px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            margin: 0 10px;
            transition: all 0.3s ease;
        }
        button:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
        .features {
            margin-top: 40px;
            text-align: left;
            display: inline-block;
        }
        .feature {
            margin: 10px 0;
            opacity: 0.8;
        }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
            margin-right: 10px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎵 Audio Normalizer</h1>
        <div class="subtitle">Professional Audio Level Normalization</div>
        
        <div class="status">
            ✅ Application launched successfully!
        </div>
        
        <div class="features">
            <div class="feature">🎛️ Peak & Loudness Normalization</div>
            <div class="feature">📊 EBU R128 Compliance</div>
            <div class="feature">🎵 Multiple Format Support</div>
            <div class="feature">⚡ Batch Processing</div>
        </div>
        
        <div class="buttons">
            <button onclick="startApp()">
                <span class="loading" id="loading" style="display:none;"></span>
                Start Audio Normalizer
            </button>
            <button onclick="showInfo()">About</button>
        </div>
        
        <div id="message" style="margin-top: 20px; font-size: 14px; opacity: 0.7;"></div>
    </div>

    <script>
        function showInfo() {
            alert('Audio Normalizer v1.0\\n\\nProfessional audio level normalization tool\\n\\nSupports: MP3, WAV, FLAC, AAC, M4A, OGG\\nCompliance: EBU R128, ATSC A/85\\n\\nBuilt with Electron & Next.js');
        }
        
        function startApp() {
            const loading = document.getElementById('loading');
            const message = document.getElementById('message');
            const button = event.target;
            
            loading.style.display = 'inline-block';
            button.disabled = true;
            message.textContent = 'Starting Next.js server...';
            
            // Try to load the actual app
            setTimeout(() => {
                message.textContent = 'Loading application interface...';
                // This would normally load the Next.js app
                // For now, show success message
                setTimeout(() => {
                    loading.style.display = 'none';
                    button.disabled = false;
                    message.textContent = 'Ready! The basic Electron app is working.';
                    
                    // In a real implementation, this would navigate to localhost:3001
                    // window.location.href = 'http://localhost:3001';
                }, 2000);
            }, 1000);
        }
        
        console.log('🎵 Audio Normalizer UI loaded');
    </script>
</body>
</html>`

    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(testHTML))
    
    mainWindow.once('ready-to-show', () => {
      console.log('✅ Window ready, showing...')
      mainWindow.show()
    })

    mainWindow.on('closed', () => {
      console.log('🔚 Main window closed')
      mainWindow = null
    })

    console.log('✅ Window setup complete')

  } catch (error) {
    console.error('❌ Error creating window:', error)
    dialog.showErrorBox('Startup Error', `Failed to create window: ${error.message}`)
  }
}

app.whenReady().then(() => {
  console.log('⚡ Electron app ready')
  createWindow()
})

app.on('window-all-closed', () => {
  console.log('🔚 All windows closed, quitting...')
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log('🔄 Reactivating, creating window...')
    createWindow()
  }
})

console.log('📋 Electron main process initialized')