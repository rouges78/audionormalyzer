# Electron main — archived legacy files

These files were variants of the Electron entry point that came about during
build troubleshooting (portable exe, antivirus, self-contained, etc.).

As of 15/07/2026 the **single, authoritative** entry point is:

    electron/main.js   (formerly electron/main-professional-viz.js)

declared in `package.json` (`"main"`) and in `electron-builder.config.js`.

## Contents of this folder

| File                        | Origin / historical purpose                      |
|-----------------------------|--------------------------------------------------|
| main.js                     | old generic main (spawns the Next server)        |
| main-simple.js              | minimal debug version                             |
| main-full.js                | "full UI" variant                                 |
| main-fixed.js               | intermediate fix                                  |
| main-fixed-final.js         | "final" self-contained fix                        |
| main-standalone.js          | standalone embedded HTTP server                   |
| main-selfcontained.js       | fully self-contained version                      |
| main-with-real-audio.js     | "real audio processing" edition                   |

## Notes

- They are kept for **history** and are not included in the build package
  (removed from `files` in `package.json` and `electron-builder.config.js`).
- Some legacy scripts in `scripts/` (build-minimal, build-full-ui, build-no-icon,
  build-real-audio-exe, simple-build, fix-and-rebuild) still point to these files
  here in `legacy/`. Those scripts are candidates for removal in task **qual-02**
  of the roadmap.
- To build the desktop app use the recommended scripts: `build:exe:quick` or `build:desktop`.
