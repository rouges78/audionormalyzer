# Audio Normalizer - Distribution Guide

Questa guida spiega come creare e distribuire Audio Normalizer per tutti i formati supportati.

## 🚀 Quick Start

### Build Completo (Tutti i Formati)
```bash
npm run build:all
```

### Build Specifici
```bash
# Solo applicazione web
npm run build:dist:web

# Solo applicazioni desktop
npm run build:dist:desktop

# Solo immagini Docker
npm run build:dist:docker
```

## 📦 Formati di Distribuzione

### 1. Applicazione Web (Next.js)

**Output:** `.next/` directory per deployment
**Comando:** `npm run build:dist:web`

**Deployment Options:**
- **Vercel/Netlify:** Deploy diretto da repository
- **Server Node.js:** Usa `npm start` dopo il build
- **Static Export:** Configura `next.config.js` per export statico

### 2. Applicazioni Desktop (Electron)

**Output:** `dist/` directory con installer
**Comando:** `npm run build:dist:desktop`

**Formati per Piattaforma:**
- **Windows:** NSIS Installer (.exe), Portable (.exe), ZIP
- **macOS:** DMG (.dmg), ZIP (Intel & Apple Silicon)
- **Linux:** AppImage (.AppImage), DEB (.deb), RPM (.rpm), TAR.GZ

### 3. Container Docker

**Output:** Immagini Docker
**Comando:** `npm run build:dist:docker`

**Immagini Generate:**
- `audionormalizer/audio-normalizer:latest` - Produzione
- `audionormalizer/audio-normalizer:dev` - Sviluppo
- `audionormalizer/audio-normalizer:x.x.x` - Versione specifica

## 🛠️ Configurazione Build

### Electron Builder
Configurazione in `electron-builder.config.js`:
- Supporto multi-piattaforma
- Code signing (quando certificati disponibili)
- Auto-updater integrato
- Compressione ottimizzata

### Docker
- **Production:** Build ottimizzato con multi-stage
- **Development:** Hot reload e volume mounting
- **Nginx:** Reverse proxy opzionale

### GitHub Actions
Workflow automatico per:
- Test completi
- Build multi-piattaforma
- Release automatiche
- Pubblicazione Docker Hub

## 📋 Requisiti di Sistema

### Per Build Environment
- **Node.js:** 18.0 o superiore
- **NPM:** 8.0 o superiore
- **Git:** Per clonazione repository
- **Docker:** Per build container (opzionale)

### Target Systems
#### Desktop
- **Windows:** 10 o superiore (64-bit)
- **macOS:** 10.14 o superiore
- **Linux:** Ubuntu 18.04+ o equivalente

#### Web/Container
- **Browser:** Chrome 90+, Firefox 88+, Safari 14+
- **Server:** Node.js 18+, 2GB RAM minimo

## 🔧 Script di Build

### `build-distribution.js`
Script master per tutti i formati di distribuzione:

```bash
# Build tutto
node scripts/build-distribution.js

# Build specifico
node scripts/build-distribution.js web desktop
```

### Funzionalità:
- ✅ Setup automatico environment
- ✅ Test completi pre-build
- ✅ Build multi-formato
- ✅ Generazione note di rilascio
- ✅ Calcolo checksums
- ✅ Validazione output

## 🚀 Deployment

### Web Application

#### Vercel
```bash
# Collegamento repository
vercel --prod

# Environment variables richieste:
# TEMP_AUDIO_DIR=/tmp/audio
# OUTPUT_AUDIO_DIR=/tmp/output
```

#### Docker
```bash
# Build e run
docker build -t audionormalizer .
docker run -p 3000:3000 audionormalizer

# Con Docker Compose
docker-compose up -d
```

#### Traditional Server
```bash
# Build e deploy
npm run build
npm start

# Con PM2
pm2 start npm --name "audio-normalizer" -- start
```

### Desktop Applications

#### Windows
1. Build: `npm run build:dist:desktop`
2. File generati in `dist/`:
   - `Audio-Normalizer-Professional-x.x.x.exe` (NSIS)
   - `Audio-Normalizer-Professional-x.x.x-Portable.exe`
   - `Audio-Normalizer-Professional-x.x.x-win.zip`

#### macOS
1. Build: `npm run build:dist:desktop`
2. File generati in `dist/`:
   - `Audio-Normalizer-Professional-x.x.x.dmg`
   - `Audio-Normalizer-Professional-x.x.x-mac.zip`

#### Linux
1. Build: `npm run build:dist:desktop`
2. File generati in `dist/`:
   - `Audio-Normalizer-Professional-x.x.x.AppImage`
   - `audio-normalizer-professional_x.x.x_amd64.deb`
   - `audio-normalizer-professional-x.x.x.x86_64.rpm`

## 🔐 Code Signing

### Windows
```javascript
// electron-builder.config.js
win: {
  certificateFile: "path/to/certificate.p12",
  certificatePassword: process.env.CSC_KEY_PASSWORD
}
```

### macOS
```javascript
// electron-builder.config.js
mac: {
  identity: "Developer ID Application: Your Name",
  provisioningProfile: "path/to/profile.mobileprovision"
}
```

## 📊 Monitoring Build

### Log Output
Tutti i build generano log dettagliati:
- `logs/build-{timestamp}.log`
- Console output con timestamp
- Informazioni su durata e dimensioni

### Distribution Info
File `dist/distribution-info.json` contiene:
```json
{
  "version": "0.1.0",
  "buildDate": "2024-01-01T00:00:00.000Z",
  "buildDuration": 120000,
  "platforms": ["web", "desktop", "docker"],
  "files": {
    "Audio-Normalizer-Professional-0.1.0.exe": {
      "size": 150000000,
      "modified": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## 🐛 Troubleshooting

### Build Errors Comuni

#### Error: "electron-builder not found"
```bash
npm install electron-builder --save-dev
```

#### Error: "Docker not found"
```bash
# Installa Docker Desktop
# Oppure skip: npm run build:dist web desktop
```

#### Error: "ENOENT: no such file or directory"
```bash
# Pulisci e reinstalla
npm run clean:temp
npm ci
```

### Performance Issues
- **Large files:** Aumenta memory: `--max-old-space-size=4096`
- **Slow builds:** Usa build incrementali
- **Disk space:** Pulisci regolarmente `dist/` e `node_modules/`

## 📱 Continuous Integration

### GitHub Actions
Workflow in `.github/workflows/build-release.yml`:
- Trigger su tag `v*` o manualmente
- Build parallelo multi-piattaforma
- Test automatici
- Release GitHub automatiche
- Push Docker Hub

### Local CI
```bash
# Simula CI localmente
npm run release
```

## 🎯 Best Practices

1. **Versioning:** Usa Semantic Versioning (x.y.z)
2. **Testing:** Run `npm run test:comprehensive` prima del build
3. **Environment:** Usa `.env.local` per configurazioni specifiche
4. **Security:** Non committare certificati o chiavi private
5. **Documentation:** Aggiorna README.md per ogni release
6. **Backup:** Mantieni backup dei file di distribuzione

## 📞 Support

Per problemi con la distribuzione:
1. Controlla i log in `logs/`
2. Verifica i requisiti di sistema
3. Consulta la documentazione GitHub
4. Crea issue con log completi

---

**Audio Normalizer Professional** - Distribuzione Professionale per Tutte le Piattaforme