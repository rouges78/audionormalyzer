# 🎵 Audio Normalizer - Windows Executable Build

Guida per creare l'eseguibile Windows (.exe) dell'Audio Normalizer.

## 📋 Prerequisiti

### Software Richiesto
- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (incluso con Node.js)
- **Git** (opzionale) - [Download](https://git-scm.com/)

### Sistema Operativo
- **Windows 10/11** (raccomandato per build Windows)
- **macOS/Linux** (supportato ma richiede configurazione aggiuntiva)

## 🚀 Build Rapido

### Comando Singolo
```bash
npm run build:exe
```

Questo comando:
1. Installa le dipendenze
2. Builda l'app Next.js
3. Crea l'eseguibile Electron
4. Genera l'installer Windows

## 🔧 Build Manuale

### 1. Installa Dipendenze
```bash
npm install
```

### 2. Build Next.js
```bash
npm run build
```

### 3. Build Electron
```bash
npm run electron:dist
```

## 📁 Output

### File Generati
```
dist/
├── Audio Normalizer Setup 0.1.0.exe    # Installer Windows
├── win-unpacked/                        # App non impacchettata
│   ├── Audio Normalizer.exe            # Eseguibile principale
│   ├── resources/                       # Risorse app
│   └── ...
└── latest.yml                          # Metadata aggiornamenti
```

### Dimensioni Tipiche
- **Installer**: ~150-200 MB
- **App installata**: ~300-400 MB
- **Eseguibile**: ~200 MB

## 🎯 Tipi di Build

### 1. Installer (NSIS)
```bash
npm run electron:dist
```
- Crea installer Windows completo
- Include disinstallatore
- Registra nel sistema
- Crea collegamenti desktop/menu

### 2. Portable
```bash
npm run electron:pack
```
- Crea versione portable
- Non richiede installazione
- Cartella auto-contenuta

### 3. Development
```bash
npm run electron:dev
```
- Avvia in modalità sviluppo
- Hot reload abilitato
- DevTools aperti

## ⚙️ Configurazione

### Personalizzazione Build
Modifica `package.json` sezione `"build"`:

```json
{
  "build": {
    "appId": "com.audionormalizer.app",
    "productName": "Audio Normalizer",
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    }
  }
}
```

### Icone Personalizzate
Sostituisci i file in `assets/`:
- `icon.ico` - Windows (256x256)
- `icon.png` - Linux (512x512)
- `icon.icns` - macOS (512x512)

### Firma Digitale (Opzionale)
Per distribuire pubblicamente:

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.p12",
      "certificatePassword": "password"
    }
  }
}
```

## 🧪 Testing

### Test Locale
```bash
# Build e test
npm run build:exe
cd dist/win-unpacked
"Audio Normalizer.exe"
```

### Test Installer
```bash
# Installa da installer
dist/"Audio Normalizer Setup 0.1.0.exe"
```

### Test Funzionalità
1. **Upload file audio** - Drag & drop
2. **Analisi automatica** - Verifica livelli
3. **Normalizzazione** - Peak e Loudness
4. **Download risultati** - File singoli e ZIP
5. **Menu applicazione** - Tutte le opzioni

## 🔍 Troubleshooting

### Errori Comuni

#### "electron-builder not found"
```bash
npm install electron-builder --save-dev
```

#### "FFmpeg not working"
```bash
npm run setup:audio
npm run test:audio
```

#### "Build fails on Windows"
- Esegui come Amministratore
- Disabilita antivirus temporaneamente
- Verifica spazio disco (>2GB liberi)

#### "App non si avvia"
- Verifica Node.js 18+
- Controlla log in `%APPDATA%/Audio Normalizer/logs/`
- Reinstalla Visual C++ Redistributable

### Debug Build
```bash
# Build con debug
DEBUG=electron-builder npm run electron:dist

# Log dettagliati
npm run electron:dist -- --verbose
```

### Pulizia Cache
```bash
# Pulisci cache Electron
npm run clean:temp
rm -rf node_modules/.cache
rm -rf dist/
```

## 📦 Distribuzione

### Distribuzione Locale
1. Condividi il file `.exe` installer
2. Gli utenti eseguono l'installer
3. L'app si installa automaticamente

### Distribuzione Online
1. Upload installer su server/GitHub Releases
2. Condividi link download
3. Considera firma digitale per evitare warning

### Auto-Update (Avanzato)
Configura aggiornamenti automatici:

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "audio-normalizer"
    }
  }
}
```

## 🎨 Personalizzazione

### Branding
- Modifica nome app in `package.json`
- Sostituisci icone in `assets/`
- Personalizza splash screen
- Modifica colori tema

### Funzionalità Extra
- Aggiungi menu contestuali
- Integra con Windows Explorer
- Supporto associazioni file
- Notifiche sistema

## 📊 Performance

### Ottimizzazioni Build
- Usa `--win --x64` per target specifico
- Abilita compressione: `"compression": "maximum"`
- Escludi file non necessari: `"files": ["!tests/**/*"]`

### Runtime Performance
- L'app usa ~100-200MB RAM
- Processing audio: CPU intensivo
- Temp files: puliti automaticamente

## 🔐 Sicurezza

### Best Practices
- Non includere credenziali nel build
- Valida input utente
- Sandbox processi audio
- Aggiorna dipendenze regolarmente

### Antivirus
- Alcuni antivirus potrebbero flaggare l'app
- Considera firma digitale
- Testa con Windows Defender
- Documenta falsi positivi

## 📞 Supporto

### Problemi Build
1. Controlla log di build
2. Verifica prerequisiti
3. Testa su sistema pulito
4. Consulta documentazione Electron

### Problemi Runtime
1. Controlla log applicazione
2. Testa funzionalità audio
3. Verifica permessi file
4. Reinstalla se necessario

---

**Audio Normalizer** - Build professionale per Windows con Electron.

Per supporto: [GitHub Issues](https://github.com/your-repo/audio-normalizer/issues)