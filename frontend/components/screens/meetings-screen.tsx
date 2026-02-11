"use client"

import React from "react"

import { useState, useRef } from "react"
import {
  Search,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ThinkingSteps } from "@/components/thinking-steps"
import type { ThinkingStep } from "@/lib/types"
import { extractMeeting } from "@/lib/api"

export function MeetingsScreen() {
  const [transcript, setTranscript] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [steps, setSteps] = useState<ThinkingStep[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    try {
      const data = await extractMeeting(transcript)
      setSteps(data.steps)
      setResult(data.response)
    } catch {
      setResult("Er ging iets mis bij het analyseren van het transcript. Probeer het opnieuw.")
    } finally {
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

        {/* Input area */}
        <Card className="mb-6">
          <CardContent className="p-4">
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
            <CardContent className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Sonja analyseert het transcript...
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {result && !isAnalyzing && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <CardTitle className="text-base">Analyse compleet</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <ThinkingSteps steps={steps} defaultOpen />
              <div className="mt-3 rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-card-foreground">
                {result.split("\n").map((line, i) => (
                  <span key={i}>
                    {line.startsWith("**") && line.endsWith("**") ? (
                      <strong className="text-foreground">
                        {line.slice(2, -2)}
                      </strong>
                    ) : line.startsWith("- ") ? (
                      <span className="ml-4 block text-muted-foreground">
                        {"  • "}
                        {line.slice(2)}
                      </span>
                    ) : line.match(/^\d+\./) ? (
                      <span className="ml-2 block">{line}</span>
                    ) : (
                      line
                    )}
                    {i < result.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
