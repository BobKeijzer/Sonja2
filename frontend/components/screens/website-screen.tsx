"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Search,
  Loader2,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SonjaAvatar } from "@/components/sonja-avatar"
import { ThinkingSteps } from "@/components/thinking-steps"
import { MarkdownContent } from "@/components/markdown-content"
import type { ThinkingStep } from "@/lib/types"
import { analyzeWebsite } from "@/lib/api"

const STORAGE_KEY = "sonja-website-prompt"

const DEFAULT_PROMPT = `Scrape de volgende URL met de scrape_website tool en analyseer de pagina op: SEO, contentkwaliteit, tone of voice en call-to-actions. Geef een bondige analyse in het Nederlands.`

function getStoredPrompt(): string {
  if (typeof window === "undefined") return DEFAULT_PROMPT
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ?? DEFAULT_PROMPT
  } catch {
    return DEFAULT_PROMPT
  }
}

export function WebsiteScreen() {
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [steps, setSteps] = useState<ThinkingStep[]>([])
  const [showPromptEdit, setShowPromptEdit] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [resultAvatar, setResultAvatar] = useState<"blij" | "koffie">("blij")
  const [loadingPhase, setLoadingPhase] = useState<"denken" | "regelen">("denken")
  const koffieTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setPrompt(getStoredPrompt())
  }, [])

  useEffect(() => {
    if (!result || isAnalyzing) return
    setResultAvatar("blij")
    if (koffieTimeoutRef.current) clearTimeout(koffieTimeoutRef.current)
    koffieTimeoutRef.current = setTimeout(() => setResultAvatar("koffie"), 3000)
    return () => {
      if (koffieTimeoutRef.current) clearTimeout(koffieTimeoutRef.current)
    }
  }, [result, isAnalyzing])

  useEffect(() => {
    if (!isAnalyzing) {
      setLoadingPhase("denken")
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current)
      return
    }
    loadingIntervalRef.current = setInterval(() => {
      setLoadingPhase((p) => (p === "denken" ? "regelen" : "denken"))
    }, 2000)
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

  const handleAnalyze = async () => {
    if (!url.trim()) return
    setIsAnalyzing(true)
    setResult(null)
    setSteps([])

    try {
      const data = await analyzeWebsite(url, prompt.trim() || undefined)
      setSteps(data.steps)
      setResult(data.response)
    } catch {
      setResult("Er ging iets mis bij het analyseren van de website. Probeer het opnieuw.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">
            Website Analyse
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Laat Sonja een pagina analyseren op SEO, content, tone of voice en
            CTA effectiviteit
          </p>
        </div>

        {/* Prompt editor: bewerkbaar, opgeslagen in localStorage; reset herstelt originele standaard */}
        {showPromptEdit && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold text-card-foreground">
                  Analyse prompt (bewerkbaar, wordt opgeslagen)
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
                De URL wordt automatisch onder de prompt geplakt. Reset herstelt de originele standaardprompt.
              </p>
            </CardContent>
          </Card>
        )}

        {/* URL input */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 pb-3">
              <span className="text-sm text-muted-foreground">URL</span>
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
            <div className="flex items-center gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.afas.nl/blog/..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAnalyze()
                }}
                className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                className="gap-2"
                onClick={handleAnalyze}
                disabled={!url.trim() || isAnalyzing}
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

        {/* Loading */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-20">
            <SonjaAvatar mood={loadingPhase} size="lg" alt="Sonja" />
            <p className="mt-3 text-sm text-muted-foreground">
              {loadingPhase === "denken"
                ? "Sonja is aan het nadenken..."
                : "Sonja is aan het regelen..."}
            </p>
          </div>
        )}

        {/* Results */}
        {result && !isAnalyzing && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <SonjaAvatar mood={resultAvatar} size="sm" alt="Sonja" />
              <span className="text-sm text-muted-foreground">
                {resultAvatar === "blij" ? "Klaar!" : "Tot de volgende keer."}
              </span>
            </div>
            <Card>
            <CardContent className="p-5">
              <ThinkingSteps steps={steps} defaultOpen />
              <div className="mt-3 rounded-lg bg-muted/50 p-4">
                <MarkdownContent content={result} />
              </div>
            </CardContent>
          </Card>
          </>
        )}

        {/* Empty state */}
        {!result && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-20">
            <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              Voer een URL in om te beginnen
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sonja analyseert de pagina op SEO, content kwaliteit en meer
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
