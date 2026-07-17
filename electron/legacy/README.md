# Electron main — file legacy archiviati

Questi file erano varianti dell'entry-point Electron nate durante il
troubleshooting delle build (portable exe, antivirus, self-contained, ecc.).

A partire dal 15/07/2026 l'entry-point **autorevole e unico** è:

    electron/main.js   (ex electron/main-professional-viz.js)

dichiarato in `package.json` (`"main"`) e in `electron-builder.config.js`.

## Contenuto di questa cartella

| File                        | Origine / scopo storico                          |
|-----------------------------|--------------------------------------------------|
| main.js                     | vecchio main generico (spawn del server Next)    |
| main-simple.js              | versione minimale di debug                        |
| main-full.js                | variante "full UI"                                |
| main-fixed.js               | fix intermedio                                    |
| main-fixed-final.js         | fix "finale" self-contained                       |
| main-standalone.js          | server HTTP embedded standalone                   |
| main-selfcontained.js       | versione completamente self-contained             |
| main-with-real-audio.js     | edizione "real audio processing"                  |

## Note

- Sono conservati per **storico**, non vengono inclusi nel pacchetto della build
  (rimossi dai `files` in `package.json` ed `electron-builder.config.js`).
- Alcuni script legacy in `scripts/` (build-minimal, build-full-ui, build-no-icon,
  build-real-audio-exe, simple-build, fix-and-rebuild) puntano ancora a questi file
  qui in `legacy/`. Tali script sono candidati alla rimozione nel task **qual-02**
  della roadmap.
- Per costruire il desktop usa gli script raccomandati: `build:exe:quick` o `build:desktop`.
