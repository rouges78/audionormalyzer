/**
 * Engine nativo: analisi e normalizzazione con un ffmpeg vero (core-04).
 *
 * È l'unico engine che **misura davvero** la loudness. Gli altri due
 * dichiarano stime: WebAudio applica un guadagno costante, e l'analisi lato
 * server senza ffmpeg restituiva finora valori di comodo marcati come
 * `estimated` (vedi core-03). Qui i numeri vengono dal filtro `ebur128`, che è
 * l'implementazione di riferimento di EBU R128 dentro ffmpeg.
 *
 * COSA MISURA, E CON COSA
 *   `ebur128=peak=sample+true` → I (LUFS integrata), LRA, sample peak, true peak
 *   `volumedetect`             → mean_volume, che usiamo come livello RMS
 *
 * I due filtri stanno in catena in una sola passata: `ebur128` lascia passare
 * l'audio invariato, quindi `volumedetect` a valle misura comunque l'originale.
 * Una passata sola invece di due dimezza il costo su file lunghi.
 *
 * COSA NON FA (ancora)
 * La normalizzazione di loudness è a **passata singola**: `loudnorm` stima e
 * corregge nello stesso passaggio. È conforme e centra il target su materiale
 * omogeneo, ma su musica con dinamica ampia la doppia passata è più precisa.
 * Quella è core-09, e resta aperta di proposito.
 */

import { spawn } from 'child_process'
import path from 'path'
import type {
  AudioAnalysis,
  NormalizationOptions,
  NormalizationResult,
} from '@/types/audio'
import { resolveFfmpeg, resolveFfmpegPath } from '@/lib/ffmpeg-binary'
import {
  AudioEngine,
  EngineCapabilities,
  EngineInput,
  EngineKind,
  assertAccepts,
} from './types'

/**
 * `ebur128` scrive una riga di log **per ogni frame** analizzato: su una
 * traccia di cinque minuti sono decine di migliaia di righe e diversi MB di
 * stderr, per poi usarne venti alla fine. L'opzione `framelog=quiet` che
 * risolverebbe la cosa non esiste in tutte le versioni di ffmpeg (in 4.4 fa
 * fallire l'inizializzazione del filtro), quindi invece di dipendere dalla
 * versione scartiamo le righe per-frame mentre arrivano: sono riconoscibili
 * dal marcatore ` t: ` seguito dal timestamp.
 */
const PER_FRAME_LINE = /\]\s+t:\s/

/** Tetto di sicurezza su quanto stderr teniamo in memoria. */
const MAX_STDERR_BYTES = 256 * 1024

/** Esito grezzo di una invocazione di ffmpeg. */
interface FfmpegRun {
  code: number | null
  stderr: string
}

/**
 * Esegue ffmpeg raccogliendo stderr, che è dove ffmpeg scrive **tutto**:
 * diagnostica, errori e output dei filtri di misura.
 *
 * Usiamo `spawn` e non `execFile` proprio per poter filtrare in streaming: con
 * execFile lo stderr si accumula per intero prima di essere consegnato, e su
 * file lunghi si sfonda il maxBuffer.
 */
function runFfmpeg(bin: string, args: string[]): Promise<FfmpegRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true })

    let kept = ''
    let pending = ''

    child.stderr.on('data', (chunk: Buffer) => {
      pending += chunk.toString()
      const lines = pending.split('\n')
      // L'ultimo elemento può essere una riga incompleta: resta in attesa.
      pending = lines.pop() ?? ''
      for (const line of lines) {
        if (PER_FRAME_LINE.test(line)) continue
        if (kept.length < MAX_STDERR_BYTES) kept += line + '\n'
      }
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (pending && !PER_FRAME_LINE.test(pending)) kept += pending
      resolve({ code, stderr: kept })
    })
  })
}

/** Converte in numero, restituendo undefined per `-inf`, `nan` e simili. */
function finite(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

/** Misure estratte dallo stderr di ffmpeg. Tutti i campi possono mancare. */
export interface LoudnessMeasurements {
  lufsIntegrated?: number
  loudnessRange?: number
  samplePeak?: number
  truePeak?: number
  rmsLevel?: number
}

/**
 * Estrae le misure dal riepilogo di `ebur128` e da `volumedetect`.
 *
 * Il riepilogo di ebur128 è indentato e diviso in sezioni, e la chiave `Peak:`
 * compare **due volte** — una sotto "Sample peak", una sotto "True peak" — con
 * lo stesso identico testo. Non si può quindi cercare `Peak:` da solo: bisogna
 * sapere in quale sezione si sta leggendo. Da qui il piccolo automa a stati.
 *
 * Esportata perché il parsing è la parte più fragile dell'engine e merita test
 * propri, senza dover eseguire ffmpeg.
 */
export function parseLoudness(stderr: string): LoudnessMeasurements {
  const out: LoudnessMeasurements = {}
  let section: 'integrated' | 'lra' | 'sample' | 'true' | null = null

  for (const rawLine of stderr.split('\n')) {
    const line = rawLine.trim()

    if (line.startsWith('Integrated loudness')) { section = 'integrated'; continue }
    if (line.startsWith('Loudness range')) { section = 'lra'; continue }
    if (line.startsWith('Sample peak')) { section = 'sample'; continue }
    if (line.startsWith('True peak')) { section = 'true'; continue }

    const i = line.match(/^I:\s*(-?[\d.]+|-?inf)\s*LUFS/i)
    if (i && section === 'integrated') { out.lufsIntegrated = finite(i[1]); continue }

    const lra = line.match(/^LRA:\s*(-?[\d.]+|-?inf)\s*LU/i)
    if (lra && section === 'lra') { out.loudnessRange = finite(lra[1]); continue }

    const peak = line.match(/^Peak:\s*(-?[\d.]+|-?inf)\s*dB/i)
    if (peak) {
      if (section === 'sample') out.samplePeak = finite(peak[1])
      else if (section === 'true') out.truePeak = finite(peak[1])
      continue
    }

    const mean = line.match(/mean_volume:\s*(-?[\d.]+|-?inf)\s*dB/i)
    if (mean) { out.rmsLevel = finite(mean[1]); continue }

    // Rete di sicurezza: se ebur128 non ha prodotto il sample peak (dipende
    // dalle opzioni supportate dalla versione), volumedetect lo dà comunque.
    const max = line.match(/max_volume:\s*(-?[\d.]+|-?inf)\s*dB/i)
    if (max && out.samplePeak === undefined) out.samplePeak = finite(max[1])
  }

  return out
}

/** Dati di contenitore letti dall'header, non stimati. */
interface ContainerInfo {
  duration: number
  sampleRate: number
  channels: number
  format?: string
  bitrate?: number
}

/**
 * Legge i dati di contenitore con `music-metadata`, la stessa libreria che
 * `audio-processor` usa dal 27/07 (core-03). Non si duplica la logica e
 * soprattutto non si introduce una seconda verità sugli stessi campi.
 */
async function readContainer(filePath: string): Promise<ContainerInfo> {
  const { parseFile } = await import('music-metadata')
  const meta = await parseFile(filePath, { duration: true })
  const f = meta.format
  return {
    duration: f.duration ?? 0,
    sampleRate: f.sampleRate ?? 0,
    channels: f.numberOfChannels ?? 0,
    format: path.extname(filePath).replace('.', '').toUpperCase() || undefined,
    bitrate: f.bitrate,
  }
}

export class NativeEngine implements AudioEngine {
  readonly name = 'ffmpeg-native'
  readonly kind: EngineKind = 'native'
  readonly capabilities: EngineCapabilities = {
    runtime: 'server',
    measuresLufs: true,
    measuresLoudnessRange: true,
    truePeakLimiting: true,
    previewOnly: false,
    accepts: ['path'],
  }

  /** Disponibile solo lato server e solo se un ffmpeg risponde davvero. */
  async isAvailable(): Promise<boolean> {
    if (typeof window !== 'undefined') return false
    return (await resolveFfmpeg()) !== null
  }

  private async requireBinary(): Promise<string> {
    const bin = await resolveFfmpegPath()
    if (!bin) {
      throw new Error(
        'ffmpeg non trovato. Imposta FFMPEG_PATH, installa il pacchetto ' +
          'ffmpeg-static, oppure rendi ffmpeg raggiungibile dal PATH.',
      )
    }
    return bin
  }

  /**
   * Misura loudness e picchi in una sola passata, senza produrre output audio
   * (`-f null -`): a ffmpeg serve una destinazione, ma i byte li buttiamo.
   */
  async measure(filePath: string): Promise<LoudnessMeasurements> {
    const bin = await this.requireBinary()
    const { stderr } = await runFfmpeg(bin, [
      '-nostdin',
      '-hide_banner',
      '-i',
      filePath,
      '-af',
      'ebur128=peak=sample+true,volumedetect',
      '-f',
      'null',
      '-',
    ])
    return parseLoudness(stderr)
  }

  async analyze(input: EngineInput): Promise<AudioAnalysis> {
    assertAccepts(this, input)
    const filePath = (input as { kind: 'path'; path: string }).path

    const [container, m] = await Promise.all([
      readContainer(filePath),
      this.measure(filePath),
    ])

    // `source` dice all'interfaccia quanto fidarsi dei numeri (core-03). Qui è
    // 'measured' solo se la LUFS c'è davvero: su un file corrotto o vuoto
    // ebur128 non produce nulla, e sarebbe scorretto dichiarare una misura.
    const measured = m.lufsIntegrated !== undefined

    return {
      duration: container.duration,
      sampleRate: container.sampleRate,
      channels: container.channels,
      format: container.format,
      bitrate: container.bitrate,
      peakLevel: m.samplePeak ?? 0,
      rmsLevel: m.rmsLevel ?? 0,
      lufsIntegrated: m.lufsIntegrated ?? 0,
      truePeak: m.truePeak ?? m.samplePeak ?? 0,
      loudnessRange: m.loudnessRange,
      // Clipping: sample peak a 0 dBFS o oltre. La soglia non è a zero esatto
      // perché la quantizzazione a 16 bit produce massimi come -0.0.
      hasClipping: (m.samplePeak ?? -Infinity) >= -0.1,
      source: measured ? 'measured' : 'partial',
    }
  }

  async normalize(
    input: EngineInput,
    options: NormalizationOptions,
  ): Promise<NormalizationResult> {
    assertAccepts(this, input)
    const filePath = (input as { kind: 'path'; path: string }).path
    const start = Date.now()

    try {
      const bin = await this.requireBinary()
      const before = await this.analyze(input)

      const filter =
        options.method === 'loudness'
          ? // TP=-1.0 è il tetto di true peak raccomandato da EBU R128 per la
            // distribuzione; LRA=11 è il valore di riferimento del filtro.
            `loudnorm=I=${options.targetLevel}:TP=-1.0:LRA=11.0`
          : // Metodo peak: guadagno costante che porta il picco al target.
            `volume=${(options.targetLevel - before.peakLevel).toFixed(2)}dB`

      const args = [
        '-nostdin',
        '-hide_banner',
        '-y',
        '-i',
        filePath,
        '-af',
        filter,
      ]

      // TRAPPOLA: `loudnorm` lavora internamente a 192 kHz e, se non gli si
      // dice altro, **scrive l'output a 192 kHz**. Un file 44.1 kHz tornava
      // indietro quadruplicato di peso e con un sample rate che l'utente non
      // ha mai chiesto. Riforziamo il rate d'origine.
      if (before.sampleRate > 0) args.push('-ar', String(before.sampleRate))

      args.push(options.outputPath)

      const { code, stderr } = await runFfmpeg(bin, args)
      if (code !== 0) {
        throw new Error(
          `ffmpeg è uscito con codice ${code}. ${lastMeaningfulLine(stderr)}`,
        )
      }

      // Misura reale del risultato: è l'unico modo onesto di dire "finalLoudness".
      const after = await this.measure(options.outputPath)

      const reference =
        options.method === 'peak' ? before.peakLevel : before.lufsIntegrated
      const achieved =
        options.method === 'peak'
          ? after.samplePeak ?? options.targetLevel
          : after.lufsIntegrated ?? options.targetLevel

      return {
        success: true,
        outputPath: options.outputPath,
        gainApplied: Number((achieved - reference).toFixed(2)),
        finalLoudness: Number(
          (after.lufsIntegrated ?? before.lufsIntegrated).toFixed(2),
        ),
        processingTime: Date.now() - start,
      }
    } catch (error) {
      return {
        success: false,
        gainApplied: 0,
        finalLoudness: 0,
        processingTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      }
    }
  }
}

/**
 * Ultima riga non vuota dello stderr: quando ffmpeg fallisce, il motivo vero
 * ("No such file or directory", "Invalid data found...") è quasi sempre lì.
 * Meglio di un generico "processo fallito" (err-02).
 */
function lastMeaningfulLine(stderr: string): string {
  const lines = stderr.split('\n').map((l) => l.trim()).filter(Boolean)
  return lines[lines.length - 1] ?? ''
}

export function createNativeEngine(): NativeEngine {
  return new NativeEngine()
}
