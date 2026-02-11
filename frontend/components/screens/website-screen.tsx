"use client"

import React from "react"

import { useState } from "react"
import {
  Search,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ThinkingSteps } from "@/components/thinking-steps"
import type { ThinkingStep } from "@/lib/types"
import { analyzeWebsite } from "@/lib/api"

export function WebsiteScreen() {
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [steps, setSteps] = useState<ThinkingStep[]>([])

  const handleAnalyze = async () => {
    if (!url.trim()) return
    setIsAnalyzing(true)
    setResult(null)
    setSteps([])

    try {
      const data = await analyzeWebsite(url)
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

        {/* URL input */}
        <Card className="mb-6">
          <CardContent className="p-4">
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
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Sonja analyseert de pagina...
            </p>
          </div>
        )}

        {/* Results */}
        {result && !isAnalyzing && (
          <Card>
            <CardContent className="p-5">
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
