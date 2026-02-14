"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Search,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  X,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SonjaAvatar } from "@/components/sonja-avatar"
import { ThinkingSteps } from "@/components/thinking-steps"
import { MarkdownContent } from "@/components/markdown-content"
import type { ThinkingStep } from "@/lib/types"
import { extractMeetingStream } from "@/lib/api"

const STORAGE_KEY = "sonja-meetings-prompt"

const DEFAULT_PROMPT = `Uit onderstaand vergadertranscript: haal actiepunten, to-do's en leerpunten/kennis. Sla de leerpunten en relevante kennis op met write_to_memory. Geef daarna een kort overzicht van wat je hebt opgeslagen en de actiepunten.`

function getStoredPrompt(): string {
  if (typeof window === "undefined") return DEFAULT_PROMPT
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ?? DEFAULT_PROMPT
  } catch {
    return DEFAULT_PROMPT
  }
}

export function MeetingsScreen() {
  const [transcript, setTranscript] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [steps, setSteps] = useState<ThinkingStep[]>([])
  const [pendingSteps, setPendingSteps] = useState<ThinkingStep[]>([])
  const [showPromptEdit, setShowPromptEdit] = useState(false)
  const [prompt, setPrompt] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [resultAvatar, setResultAvatar] = useState<"blij" | "koffie">("blij")
  const [loadingPhase, setLoadingPhase] = useState<"denken" | "regelen">("denken")
  const koffieTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setPrompt(getStoredPrompt())
  }, [])

  // Na resultaat: eerst blij, na 3s koffie
  useEffect(() => {
    if (!result || isAnalyzing) return
    setResultAvatar("blij")
    if (koffieTimeoutRef.current) clearTimeout(koffieTimeoutRef.current)
    koffieTimeoutRef.current = setTimeout(() => setResultAvatar("koffie"), 3000)
    return () => {
      if (koffieTimeoutRef.current) clearTimeout(koffieTimeoutRef.current)
    }
  }, [result, isAnalyzing])

  // Tijdens laden: afwisselen denken / regelen
  useEffect(() => {
    if (!isAnalyzing) {
      setLoadingPhase("denken")
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current)
      return
    }
    loadingIntervalRef.current = setInterval(() => {
      setLoadingPhase((p) => (p === "denken" ? "regelen" : "denken"))
    }, 5000)
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current)
    }
  }, [isAnalyzing])

  const handlePromptChange = (value: string) => {
    setPrompt(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch { /* ignore */ }
  }

  const resetPromptToDefault = () => {
    setPrompt(DEFAULT_PROMPT)
    try {
      localStorage.setItem(STORAGE_KEY, DEFAULT_PROMPT)
    } catch { /* ignore */ }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setTranscript(ev.target?.result as string)
    }
    reader.readAsText(file)
  }

  const handleAnalyze = async () => {
    if (!transcript.trim()) return
    setIsAnalyzing(true)
    setResult(null)
    setSteps([])
    setPendingSteps([])

    try {
      const data = await extractMeetingStream(
        transcript,
        prompt.trim() || undefined,
        (step) => setPendingSteps((prev) => [...prev, step])
      )
      setSteps(data.steps)
      setResult(data.response)
    } catch {
      setResult("Er ging iets mis bij het analyseren van het transcript. Probeer het opnieuw.")
    } finally {
      setPendingSteps([])
      setIsAnalyzing(false)
    }
  }

  const clearAll = () => {
    setTranscript("")
    setFileName(null)
    setResult(null)
    setSteps([])
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">
            Vergaderingen
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload een transcript en laat Sonja de actiepunten en besluiten
            extraheren
          </p>
        </div>

        {/* Prompt editor: bewerkbaar, opgeslagen in localStorage; reset herstelt originele standaard */}
        {showPromptEdit && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold text-card-foreground">
                  Extractie prompt (bewerkbaar, wordt opgeslagen)
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={resetPromptToDefault}
                >
                  Reset naar standaard
                </Button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                rows={6}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-2 text-[10px] text-muted-foreground">
                Het transcript wordt automatisch onder de prompt geplakt. Reset herstelt de originele standaardprompt.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Input area */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-sm text-muted-foreground">Transcript</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowPromptEdit((b) => !b)}
              >
                <Settings className="h-3.5 w-3.5" />
                {showPromptEdit ? "Verberg prompt" : "Prompt"}
              </Button>
            </div>
            <div className="relative">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Plak het vergadering transcript hier..."
                rows={8}
                className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {transcript && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt,.doc,.docx,.md"
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-transparent"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Upload bestand
              </Button>
              {fileName && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {fileName}
                </span>
              )}
              <div className="flex-1" />
              <Button
                size="sm"
                className="gap-2"
                onClick={handleAnalyze}
                disabled={!transcript.trim() || isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Analyseer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isAnalyzing && (
          <Card>
            <CardContent className="flex flex-col items-center py-16">
              <div className="flex flex-col items-center gap-3">
                <SonjaAvatar mood="denken" size="lg" alt="Sonja" />
                <p className="text-sm text-muted-foreground">
                  {loadingPhase === "denken"
                    ? "Sonja is aan het nadenken..."
                    : "Sonja is aan het regelen..."}
                </p>
              </div>
              {pendingSteps.length > 0 && (
                <div className="mt-4 w-full max-w-xl">
                  <ThinkingSteps steps={pendingSteps} defaultOpen />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {result && !isAnalyzing && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <SonjaAvatar mood={resultAvatar} size="sm" alt="Sonja" />
              {resultAvatar === "blij" && (
                <span className="text-sm text-muted-foreground">Klaar!</span>
              )}
            </div>
            <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <CardTitle className="text-base">Analyse compleet</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <ThinkingSteps steps={steps} defaultOpen />
              <div className="mt-3 rounded-lg bg-muted/50 p-4">
                <MarkdownContent content={result} />
              </div>
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </div>
  )
}
