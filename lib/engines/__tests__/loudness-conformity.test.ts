/**
 * Conformità EBU R128 su file audio VERI (test-02).
 *
 * Fino a oggi la suite copriva la normalizzazione solo con mock: si verificava
 * che ffmpeg venisse invocato con certi argomenti, mai che il file uscito
 * avesse la loudness richiesta. Sono due domande diverse, e la seconda è
 * l'unica che interessa a chi usa il programma.
 *
 * Qui i file vengono generati con ffmpeg, normalizzati dal NativeEngine e poi
 * **rimisurati**: l'asserzione è sul risultato, non sul comando.
 *
 * DUE SCELTE DA GIUSTIFICARE
 *
 * 1. I test si saltano da soli se ffmpeg non c'è. Un rosso in quel caso non
 *    direbbe nulla sul codice, direbbe solo che la macchina non ha ffmpeg —
 *    ed è la condizione normale in cui l'app ricade sull'engine WASM.
 *
 * 2. I file temporanei stanno in `os.tmpdir()` e non sotto la cartella del
 *    progetto. Sulla cartella di lavoro montata via FUSE `unlink()` è vietato
 *    e ogni pulizia fallisce con EPERM (test-09): scrivere altrove è il modo
 *    più semplice per non falsare la misura.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { NativeEngine } from '@/lib/engines/native-engine'
import { resolveFfmpegPath } from '@/lib/ffmpeg-binary'

const execFileAsync = promisify(execFile)

let workDir = ''
let ffmpeg: string | null = null

/**
 * Tolleranza sul target di loudness, in LU.
 *
 * EBU R128 ammette ±0.5 LU sulla loudness di programma, ma quella tolleranza
 * vale per la misura, non per una correzione a passata singola. `loudnorm` in
 * un solo passaggio stima e corregge insieme, quindi su materiale reale scarta
 * un po' di più. 1.0 LU è stretto abbastanza da smascherare un errore vero
 * (un segno sbagliato, un target ignorato) e largo abbastanza da non
 * lampeggiare rosso a ogni versione di ffmpeg. La doppia passata, che
 * permetterebbe di stringere, è core-09.
 */
const TOLLERANZA_LU = 1.0

/** Genera un file di prova con ffmpeg. */
async function genera(
  nome: string,
  opts: { freq: number; durata: number; gainDb: number; rate?: number; canali?: number },
): Promise<string> {
  const out = path.join(workDir, nome)
  const rate = opts.rate ?? 44100
  await execFileAsync(ffmpeg!, [
    '-nostdin', '-hide_banner', '-y',
    '-f', 'lavfi',
    '-i', `sine=frequency=${opts.freq}:duration=${opts.durata}:sample_rate=${rate}`,
    '-ac', String(opts.canali ?? 2),
    '-af', `volume=${opts.gainDb}dB`,
    '-c:a', 'pcm_s16le',
    out,
  ])
  return out
}

beforeAll(async () => {
  ffmpeg = await resolveFfmpegPath()
  if (!ffmpeg) return
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'an-conformity-'))
}, 60_000)

afterAll(async () => {
  if (workDir) await fs.rm(workDir, { recursive: true, force: true })
})

// `describe.skipIf` valuta la condizione alla raccolta dei test, quando
// beforeAll non è ancora passato: la disponibilità va quindi ricontrollata
// dentro i test. Usiamo invece un flag calcolato qui, sincrono.
const senzaFfmpeg = () => ffmpeg === null

describe('Conformità EBU R128 su file reali (test-02)', () => {
  it('misura una loudness plausibile invece di un valore inventato', async () => {
    if (senzaFfmpeg()) return
    const src = await genera('misura.wav', { freq: 440, durata: 6, gainDb: -8 })
    const engine = new NativeEngine()
    const a = await engine.analyze({ kind: 'path', path: src })

    // Un seno a -8 dB sta molto sotto lo zero: se il valore fosse un
    // segnaposto (0, -23 fisso, NaN) questo controllo lo prenderebbe.
    expect(a.lufsIntegrated).toBeLessThan(-5)
    expect(a.lufsIntegrated).toBeGreaterThan(-40)
    expect(a.source).toBe('measured')

    // Il true peak non può stare sotto il sample peak: se il parsing avesse
    // confuso le due sezioni omonime del riepilogo, si vedrebbe qui.
    expect(a.truePeak).toBeGreaterThanOrEqual(a.peakLevel - 0.1)

    expect(a.sampleRate).toBe(44100)
    expect(a.channels).toBe(2)
    expect(a.duration).toBeGreaterThan(5)
  }, 60_000)

  it.each([-23, -16, -14])(
    'normalizza a %i LUFS entro la tolleranza',
    async (target) => {
      if (senzaFfmpeg()) return
      const src = await genera(`src${Math.abs(target)}.wav`, {
        freq: 440, durata: 6, gainDb: -8,
      })
      const out = path.join(workDir, `out${Math.abs(target)}.wav`)
      const engine = new NativeEngine()

      const res = await engine.normalize(
        { kind: 'path', path: src },
        { method: 'loudness', targetLevel: target, preserveFormat: true, outputPath: out },
      )
      expect(res.success).toBe(true)

      // La verifica che conta: rimisurare il file prodotto.
      const dopo = await engine.analyze({ kind: 'path', path: out })
      expect(Math.abs(dopo.lufsIntegrated - target)).toBeLessThanOrEqual(TOLLERANZA_LU)

      // `finalLoudness` deve essere la misura reale, non il target ricopiato.
      expect(Math.abs(res.finalLoudness - dopo.lufsIntegrated)).toBeLessThan(0.5)
    },
    120_000,
  )

  it('non supera il tetto di true peak a -1 dBTP', async () => {
    if (senzaFfmpeg()) return
    // Sorgente quasi in clipping: senza limiting il true peak sfonderebbe.
    const src = await genera('forte.wav', { freq: 440, durata: 6, gainDb: -0.5 })
    const out = path.join(workDir, 'forte-out.wav')
    const engine = new NativeEngine()

    const res = await engine.normalize(
      { kind: 'path', path: src },
      { method: 'loudness', targetLevel: -14, preserveFormat: true, outputPath: out },
    )
    expect(res.success).toBe(true)

    const dopo = await engine.analyze({ kind: 'path', path: out })
    // Margine di 0.5 dB: il limiter di loudnorm lavora sul true peak stimato.
    expect(dopo.truePeak).toBeLessThanOrEqual(-0.5)
  }, 120_000)

  it('conserva il sample rate originale invece di riscriverlo a 192 kHz', async () => {
    if (senzaFfmpeg()) return
    // Questo è il test che protegge da una trappola vera di `loudnorm`: il
    // filtro lavora internamente a 192 kHz e, senza un `-ar` esplicito,
    // scrive l'output a quel rate. Il file tornava indietro pesando quattro
    // volte tanto, con un sample rate che nessuno aveva chiesto.
    const src = await genera('rate.wav', { freq: 440, durata: 4, gainDb: -10, rate: 44100 })
    const out = path.join(workDir, 'rate-out.wav')
    const engine = new NativeEngine()

    const res = await engine.normalize(
      { kind: 'path', path: src },
      { method: 'loudness', targetLevel: -16, preserveFormat: true, outputPath: out },
    )
    expect(res.success).toBe(true)

    const dopo = await engine.analyze({ kind: 'path', path: out })
    expect(dopo.sampleRate).toBe(44100)
    expect(dopo.channels).toBe(2)
  }, 120_000)

  it('con il metodo peak porta il picco al livello richiesto', async () => {
    if (senzaFfmpeg()) return
    const src = await genera('peak.wav', { freq: 440, durata: 4, gainDb: -12 })
    const out = path.join(workDir, 'peak-out.wav')
    const engine = new NativeEngine()

    const res = await engine.normalize(
      { kind: 'path', path: src },
      { method: 'peak', targetLevel: -3, preserveFormat: true, outputPath: out },
    )
    expect(res.success).toBe(true)

    const dopo = await engine.analyze({ kind: 'path', path: out })
    expect(Math.abs(dopo.peakLevel - -3)).toBeLessThanOrEqual(0.5)
  }, 120_000)

  it('riporta un errore leggibile sui file illeggibili, senza sollevare', async () => {
    if (senzaFfmpeg()) return
    const rotto = path.join(workDir, 'rotto.wav')
    await fs.writeFile(rotto, 'questo non è audio')
    const engine = new NativeEngine()

    const res = await engine.normalize(
      { kind: 'path', path: rotto },
      { method: 'loudness', targetLevel: -16, preserveFormat: true, outputPath: path.join(workDir, 'mai.wav') },
    )
    expect(res.success).toBe(false)
    // Il messaggio deve dire qualcosa, non essere una stringa vuota (err-02).
    expect(res.error && res.error.length).toBeGreaterThan(10)
  }, 60_000)
})
