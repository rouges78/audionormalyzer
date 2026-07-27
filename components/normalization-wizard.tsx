"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Upload, Settings, Headphones, Waves, Download, Check, ChevronRight, ChevronLeft,
  AlertCircle, Loader2, Trash2, Music, Gauge, RotateCcw,
} from "lucide-react"
import { useAudioUpload } from "@/hooks/use-audio-upload"
import { UploadProgress } from "@/components/upload-progress"
import { AudioPlayer } from "@/components/audio-player"
import { NormalizationFeedback } from "@/components/normalization-feedback"
import type { AudioFile } from "@/types/audio"
import {
  computeGain, predictAnalysis, decodeAudioFile, renderNormalizedWav,
} from "@/lib/audio-preview"

type Method = "peak" | "loudness"
type StepId = "upload" | "configure" | "preview" | "process" | "download"

const STEPS: { id: StepId; label: string; icon: React.ElementType }[] = [
  { id: "upload", label: "Carica", icon: Upload },
  { id: "configure", label: "Configura", icon: Settings },
  { id: "preview", label: "Anteprima", icon: Headphones },
  { id: "process", label: "Processa", icon: Waves },
  { id: "download", label: "Scarica", icon: Download },
]

const PRESETS: { label: string; method: Method; target: number; hint: string }[] = [
  { label: "Streaming", method: "loudness", target: -14, hint: "-14 LUFS · Spotify/YouTube" },
  { label: "Broadcast", method: "loudness", target: -23, hint: "-23 LUFS · EBU R128" },
  { label: "Picco", method: "peak", target: -1, hint: "-1 dBFS · massimo volume sicuro" },
]

interface RenderResult {
  configKey: string
  url: string
  blob: Blob
  gainDb: number
  limited: boolean
  error?: string
}

const fmtDb = (v: number, unit = "dB") =>
  `${v > 0 ? "+" : ""}${v.toFixed(1)} ${unit}`

const fileKey = (name: string, size: number) => `${name}__${size}`
const configKeyOf = (m: Method, t: number) => `${m}:${t}`

export function NormalizationWizard() {
  const {
    audioFiles, uploadProgress, isUploading, isAnalyzing,
    uploadFiles, removeFile, clearAll, error,
  } = useAudioUpload()

  const [stepIndex, setStepIndex] = useState(0)
  const [method, setMethod] = useState<Method>("loudness")
  const [target, setTarget] = useState<number>(-14)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [origUrl, setOrigUrl] = useState<string | null>(null)
  const [normUrl, setNormUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [procMap, setProcMap] = useState<Record<string, { status: "queued" | "running" | "done" | "error"; gainDb?: number; limited?: boolean; error?: string }>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  // File originali trattenuti lato client (chiave: nome__dimensione)
  const filesRef = useRef<Map<string, File>>(new Map())
  // Cache dei render WAV per file
  const renderRef = useRef<Map<string, RenderResult>>(new Map())
  // Object URL dei file originali
  const origUrlRef = useRef<Map<string, string>>(new Map())
  const previewToken = useRef(0)

  const readyFiles = useMemo(() => audioFiles.filter(f => f.status === "ready" && f.analysis), [audioFiles])
  const step = STEPS[stepIndex].id
  const configKey = configKeyOf(method, target)

  // ---- File retention & object URLs -------------------------------------
  const getFile = useCallback((af: AudioFile): File | undefined => {
    return filesRef.current.get(fileKey(af.name, af.size))
  }, [])

  const getOriginalUrl = useCallback((af: AudioFile): string | null => {
    const existing = origUrlRef.current.get(af.id)
    if (existing) return existing
    const file = getFile(af)
    if (!file) return null
    const url = URL.createObjectURL(file)
    origUrlRef.current.set(af.id, url)
    return url
  }, [getFile])

  // Render (con cache) del WAV normalizzato per un file alla config corrente
  const renderFor = useCallback(async (af: AudioFile): Promise<RenderResult> => {
    const cacheId = `${af.id}:${configKey}`
    const cached = renderRef.current.get(cacheId)
    if (cached) return cached

    const file = getFile(af)
    if (!file || !af.analysis) {
      const res: RenderResult = { configKey, url: "", blob: new Blob(), gainDb: 0, limited: false, error: "File originale non disponibile nel browser (ricaricalo)." }
      return res
    }
    const g = computeGain(af.analysis, { method, targetLevel: target })
    const buffer = await decodeAudioFile(file)
    const blob = await renderNormalizedWav(buffer, g.gainLinear)
    const url = URL.createObjectURL(blob)
    const res: RenderResult = { configKey, url, blob, gainDb: g.gainDb, limited: g.limited }
    renderRef.current.set(cacheId, res)
    return res
  }, [configKey, getFile, method, target])

  // Invalida i render quando cambia la configurazione
  useEffect(() => {
    renderRef.current.forEach(r => r.url && URL.revokeObjectURL(r.url))
    renderRef.current.clear()
    setProcMap({})
  }, [configKey])

  // ---- Preview -----------------------------------------------------------
  const runPreview = useCallback(async (af: AudioFile) => {
    const token = ++previewToken.current
    setPreviewBusy(true)
    setPreviewError(null)
    setNormUrl(null)
    try {
      const orig = getOriginalUrl(af)
      if (!orig) throw new Error("Audio originale non disponibile nel browser. Torna a 'Carica' e ricarica i file.")
      const res = await renderFor(af)
      if (token !== previewToken.current) return
      if (res.error) throw new Error(res.error)
      setOrigUrl(orig)
      setNormUrl(res.url)
    } catch (e) {
      if (token !== previewToken.current) return
      setPreviewError(e instanceof Error ? e.message : "Errore anteprima")
    } finally {
      if (token === previewToken.current) setPreviewBusy(false)
    }
  }, [getOriginalUrl, renderFor])

  // Quando entro in Anteprima o cambio file/config, (ri)genera l'anteprima
  useEffect(() => {
    if (step !== "preview") return
    const id = previewId ?? readyFiles[0]?.id ?? null
    if (id && id !== previewId) { setPreviewId(id); return }
    const af = readyFiles.find(f => f.id === id)
    if (af) runPreview(af)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, previewId, configKey, readyFiles.length])

  const previewFile = readyFiles.find(f => f.id === (previewId ?? readyFiles[0]?.id))
  const previewGain = previewFile?.analysis ? computeGain(previewFile.analysis, { method, targetLevel: target }) : null

  // ---- Processing (tutti i file) ----------------------------------------
  const runProcessing = useCallback(async () => {
    setProcessing(true)
    const init: typeof procMap = {}
    readyFiles.forEach(f => { init[f.id] = { status: "queued" } })
    setProcMap(init)

    for (const af of readyFiles) {
      setProcMap(prev => ({ ...prev, [af.id]: { status: "running" } }))
      try {
        const res = await renderFor(af)
        if (res.error) throw new Error(res.error)
        setProcMap(prev => ({ ...prev, [af.id]: { status: "done", gainDb: res.gainDb, limited: res.limited } }))
      } catch (e) {
        setProcMap(prev => ({ ...prev, [af.id]: { status: "error", error: e instanceof Error ? e.message : "Errore" } }))
      }
    }
    setProcessing(false)
  }, [readyFiles, renderFor])

  const doneCount = Object.values(procMap).filter(p => p.status === "done").length
  const procProgress = readyFiles.length ? Math.round((doneCount / readyFiles.length) * 100) : 0
  const allProcessed = readyFiles.length > 0 && doneCount === readyFiles.length

  // ---- Upload handlers ---------------------------------------------------
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const arr = Array.from(files)
    arr.forEach(f => filesRef.current.set(fileKey(f.name, f.size), f))
    await uploadFiles(arr)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (folderInputRef.current) folderInputRef.current.value = ""
  }

  const resetAll = () => {
    renderRef.current.forEach(r => r.url && URL.revokeObjectURL(r.url))
    renderRef.current.clear()
    origUrlRef.current.forEach(u => URL.revokeObjectURL(u))
    origUrlRef.current.clear()
    filesRef.current.clear()
    setProcMap({}); setPreviewId(null); setOrigUrl(null); setNormUrl(null)
    clearAll(); setStepIndex(0)
  }

  useEffect(() => () => {
    renderRef.current.forEach(r => r.url && URL.revokeObjectURL(r.url))
    origUrlRef.current.forEach(u => URL.revokeObjectURL(u))
  }, [])

  // ---- Method change adjusts sensible default target --------------------
  const changeMethod = (m: Method) => {
    setMethod(m)
    setTarget(m === "peak" ? -1 : -14)
  }
  const applyPreset = (p: typeof PRESETS[number]) => { setMethod(p.method); setTarget(p.target) }

  // ---- Step navigation ---------------------------------------------------
  const canNext = (): boolean => {
    if (step === "upload") return readyFiles.length > 0
    if (step === "process") return allProcessed
    return true
  }
  const goNext = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1))
  const goBack = () => setStepIndex(i => Math.max(i - 1, 0))
  const goto = (i: number) => { if (i <= stepIndex) setStepIndex(i) }

  const targetMin = method === "peak" ? -12 : -30
  const targetMax = method === "peak" ? 0 : -6
  const targetUnit = method === "peak" ? "dBFS" : "LUFS"

  // ======================================================================
  return (
    <div className="space-y-6">
      <Stepper stepIndex={stepIndex} onGoto={goto} />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ---------------- STEP: UPLOAD ---------------- */}
      {step === "upload" && (
        <Card className="audio-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Upload className="h-5 w-5 text-[color:var(--primary-ink)]" /> Carica i tuoi file
            </CardTitle>
            <CardDescription>
              Seleziona file singoli o un'intera cartella. Formati: MP3, WAV, FLAC, AAC, M4A, OGG.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading || isAnalyzing} variant="outline"
                className="h-20 border-2 border-dashed border-[color:var(--primary-ink)] bg-[color:var(--tint-primary)] hover:brightness-95 text-[color:var(--primary-ink)]">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-7 w-7" />
                  <span className="font-medium">{isUploading ? "Caricamento..." : isAnalyzing ? "Analisi..." : "Scegli file"}</span>
                  <span className="text-xs opacity-70">File singoli</span>
                </div>
              </Button>
              <Button onClick={() => folderInputRef.current?.click()} disabled={isUploading || isAnalyzing} variant="outline"
                className="h-20 border-2 border-dashed border-[color:var(--success)] bg-[color:var(--tint-success)] hover:brightness-95 text-[color:var(--success)]">
                <div className="flex flex-col items-center gap-2">
                  <Music className="h-7 w-7" />
                  <span className="font-medium">{isUploading ? "Caricamento..." : isAnalyzing ? "Analisi..." : "Scegli cartella"}</span>
                  <span className="text-xs opacity-70">Album completo</span>
                </div>
              </Button>
            </div>

            <input ref={fileInputRef} type="file" multiple accept="audio/*" onChange={handleUpload} className="hidden" />
            <input ref={folderInputRef} type="file" multiple accept="audio/*" onChange={handleUpload} className="hidden"
              {...({ webkitdirectory: "", directory: "" } as any)} />

            <UploadProgress items={uploadProgress} isUploading={isUploading} isAnalyzing={isAnalyzing} />

            {readyFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{readyFiles.length} file pronti</span>
                  <Button variant="ghost" size="sm" onClick={resetAll} className="text-[color:var(--danger)] hover:opacity-80">
                    <Trash2 className="h-4 w-4 mr-1" /> Cancella tutto
                  </Button>
                </div>
                <div className="divide-y rounded-lg border">
                  {readyFiles.map(f => (
                    <div key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{f.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.format?.toUpperCase()} · {f.analysis && `${f.analysis.lufsIntegrated.toFixed(1)} LUFS · picco ${f.analysis.peakLevel.toFixed(1)} dB`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getFile(f) ? <Badge variant="secondary" className="text-xs">anteprima ok</Badge>
                          : <Badge variant="outline" className="text-xs">solo dati</Badge>}
                        <Button variant="ghost" size="sm" onClick={() => removeFile(f.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------- STEP: CONFIGURE ---------------- */}
      {step === "configure" && (
        <Card className="audio-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Settings className="h-5 w-5 text-[color:var(--primary-ink)]" /> Configura la normalizzazione
            </CardTitle>
            <CardDescription>Le impostazioni si applicano a tutti i {readyFiles.length} file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => {
                const active = p.method === method && p.target === target
                return (
                  <button key={p.label} onClick={() => applyPreset(p)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${active ? "border-[color:var(--primary-ink)] bg-[color:var(--tint-primary)]" : "hover:border-[color:var(--primary-ink)]"}`}>
                    <div className="font-medium flex items-center gap-1">{active && <Check className="h-3.5 w-3.5 text-[color:var(--primary-ink)]" />}{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.hint}</div>
                  </button>
                )
              })}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label className="mb-2 block">Metodo</Label>
                <RadioGroup value={method} onValueChange={(v) => changeMethod(v as Method)} className="gap-3">
                  <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                    <RadioGroupItem value="loudness" id="m-loud" className="mt-1" />
                    <div>
                      <div className="font-medium">Loudness (LUFS) — EBU R128</div>
                      <div className="text-xs text-muted-foreground">Volume percepito coerente tra le tracce. Consigliato.</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                    <RadioGroupItem value="peak" id="m-peak" className="mt-1" />
                    <div>
                      <div className="font-medium">Picco (dBFS)</div>
                      <div className="text-xs text-muted-foreground">Porta il picco massimo al livello target.</div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Target</Label>
                  <span className="font-mono text-sm text-[color:var(--primary-ink)]">{target} {targetUnit}</span>
                </div>
                <Slider value={[target]} min={targetMin} max={targetMax} step={1}
                  onValueChange={(v) => setTarget(v[0])} className="my-4" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{targetMin} {targetUnit}</span><span>{targetMax} {targetUnit}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Gauge className="h-4 w-4" /> Un tetto true-peak di -1 dBTP viene applicato per evitare il clipping.
                </div>
              </div>
            </div>

            {/* Anteprima guadagni previsti */}
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">Guadagno previsto per file</div>
              <div className="divide-y max-h-56 overflow-auto">
                {readyFiles.map(f => {
                  const g = f.analysis ? computeGain(f.analysis, { method, targetLevel: target }) : null
                  return (
                    <div key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="truncate min-w-0">{f.name}</span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        {g?.limited && <Badge variant="outline" className="text-[10px] text-[color:var(--warning)] border-[color:var(--warning)]">gain limitato</Badge>}
                        <span className={`font-mono ${g && g.gainDb >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}`}>{g ? fmtDb(g.gainDb) : "—"}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------- STEP: PREVIEW (A/B) ---------------- */}
      {step === "preview" && (
        <Card className="audio-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Headphones className="h-5 w-5 text-[color:var(--primary-ink)]" /> Anteprima A/B
            </CardTitle>
            <CardDescription>Confronta l'originale con la versione normalizzata. Anteprima basata sul guadagno, generata nel browser.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {readyFiles.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {readyFiles.map(f => (
                  <button key={f.id} onClick={() => setPreviewId(f.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${(previewId ?? readyFiles[0]?.id) === f.id ? "border-[color:var(--primary-ink)] bg-[color:var(--tint-primary)] text-[color:var(--primary-ink)]" : "hover:border-[color:var(--primary-ink)]"}`}>
                    {f.name.length > 28 ? f.name.slice(0, 25) + "…" : f.name}
                  </button>
                ))}
              </div>
            )}

            {previewError && (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{previewError}</AlertDescription></Alert>
            )}

            {previewGain?.limited && (
              <Alert><Gauge className="h-4 w-4" /><AlertDescription className="text-sm">
                Il guadagno è stato limitato a {fmtDb(previewGain.gainDb)} per non superare il tetto true-peak di -1 dBTP (anti-clipping).
              </AlertDescription></Alert>
            )}

            {previewBusy ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Genero l'anteprima normalizzata…
              </div>
            ) : origUrl && normUrl && previewFile ? (
              <>
                <AudioPlayer originalFile={origUrl} processedFile={normUrl} fileName={previewFile.name} />
                {previewFile.analysis && previewGain && (
                  <NormalizationFeedback
                    originalAnalysis={previewFile.analysis}
                    predictedAnalysis={predictAnalysis(previewFile.analysis, previewGain.gainDb)}
                    fileName={previewFile.name}
                  />
                )}
              </>
            ) : !previewError ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Seleziona un file per l'anteprima.</div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ---------------- STEP: PROCESS ---------------- */}
      {step === "process" && (
        <Card className="audio-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Waves className="h-5 w-5 text-[color:var(--primary-ink)]" /> Processa
            </CardTitle>
            <CardDescription>Applico la normalizzazione a tutti i {readyFiles.length} file (rendering nel browser).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button onClick={runProcessing} disabled={processing || allProcessed}
                className="bg-primary hover:opacity-90 text-primary-foreground">
                {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> In corso…</>
                  : allProcessed ? <><Check className="h-4 w-4 mr-2" /> Completato</>
                    : <><Waves className="h-4 w-4 mr-2" /> Avvia normalizzazione</>}
              </Button>
              <div className="flex-1"><Progress value={procProgress} /></div>
              <span className="text-sm text-muted-foreground w-12 text-right">{procProgress}%</span>
            </div>

            <div className="divide-y rounded-lg border">
              {readyFiles.map(f => {
                const p = procMap[f.id]
                return (
                  <div key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate min-w-0">{f.name}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      {p?.limited && <Badge variant="outline" className="text-[10px] text-[color:var(--warning)] border-[color:var(--warning)]">gain limitato</Badge>}
                      {p?.gainDb !== undefined && <span className="font-mono text-xs text-muted-foreground">{fmtDb(p.gainDb)}</span>}
                      {(!p || p.status === "queued") && <Badge variant="outline" className="text-xs">in coda</Badge>}
                      {p?.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-[color:var(--primary-ink)]" />}
                      {p?.status === "done" && <Check className="h-4 w-4 text-[color:var(--success)]" />}
                      {p?.status === "error" && <Badge variant="destructive" className="text-xs">errore</Badge>}
                    </span>
                  </div>
                )
              })}
            </div>
            {Object.values(procMap).some(p => p.status === "error") && (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-sm">
                Alcuni file non sono stati processati (formato non decodificabile nel browser). Gli altri sono pronti per il download.
              </AlertDescription></Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------- STEP: DOWNLOAD ---------------- */}
      {step === "download" && (
        <Card className="audio-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Download className="h-5 w-5 text-[color:var(--primary-ink)]" /> Scarica
            </CardTitle>
            <CardDescription>File normalizzati (WAV). Il download avviene interamente sul tuo dispositivo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{doneCount} file pronti</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadAll}><Download className="h-4 w-4 mr-1" /> Scarica tutti</Button>
                <Button variant="ghost" size="sm" onClick={resetAll}><RotateCcw className="h-4 w-4 mr-1" /> Ricomincia</Button>
              </div>
            </div>
            <div className="divide-y rounded-lg border">
              {readyFiles.map(f => {
                const res = renderRef.current.get(`${f.id}:${configKey}`)
                const done = procMap[f.id]?.status === "done" && res && !res.error
                return (
                  <div key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{wavName(f.name)}</div>
                      <div className="text-xs text-muted-foreground">
                        {done ? `${(res!.blob.size / 1048576).toFixed(1)} MB · ${fmtDb(res!.gainDb)}` : "non disponibile"}
                      </div>
                    </div>
                    {done ? (
                      <a href={res!.url} download={wavName(f.name)}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                        <Download className="h-3.5 w-3.5" /> Scarica
                      </a>
                    ) : <Badge variant="outline" className="text-xs">—</Badge>}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------- NAV ---------------- */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={goBack} disabled={stepIndex === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Indietro
        </Button>
        {stepIndex < STEPS.length - 1 ? (
          <Button onClick={goNext} disabled={!canNext()} className="bg-primary hover:opacity-90 text-primary-foreground">
            Avanti <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={resetAll} variant="outline"><RotateCcw className="h-4 w-4 mr-1" /> Nuovo lavoro</Button>
        )}
      </div>
    </div>
  )

  // ---- helpers che usano lo stato del componente ----
  function downloadAll() {
    readyFiles.forEach((f, i) => {
      const res = renderRef.current.get(`${f.id}:${configKey}`)
      if (res && !res.error && res.url) {
        setTimeout(() => {
          const a = document.createElement("a")
          a.href = res.url; a.download = wavName(f.name)
          document.body.appendChild(a); a.click(); a.remove()
        }, i * 400)
      }
    })
  }
}

function wavName(name: string): string {
  return name.replace(/\.[^.]+$/, "") + "-normalized.wav"
}

// ------------------------------------------------------------------ Stepper
function Stepper({ stepIndex, onGoto }: { stepIndex: number; onGoto: (i: number) => void }) {
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i < stepIndex
        const active = i === stepIndex
        const Icon = s.icon
        return (
          <React.Fragment key={s.id}>
            <button onClick={() => onGoto(i)} disabled={i > stepIndex}
              aria-current={active ? "step" : undefined}
              className={`flex flex-col items-center gap-1.5 ${i > stepIndex ? "cursor-default" : "cursor-pointer"}`}>
              <div
                data-state={active ? "active" : done ? "done" : "todo"}
                className="nu-step-bubble flex h-11 w-11 items-center justify-center rounded-full">
                {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              {/* attivo e completato restano distinguibili: il primo è affondato
                  e in rosso brand, il secondo è in rilievo e pieno di gradiente */}
              <span className={`text-xs font-semibold ${
                active ? "text-[color:var(--primary-ink)]"
                  : done ? "text-foreground"
                    : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="nu-step-line mx-1 md:mx-3 mb-6 h-1.5 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full nu-gradient transition-all duration-300"
                  style={{ width: i < stepIndex ? "100%" : "0%" }}
                />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
