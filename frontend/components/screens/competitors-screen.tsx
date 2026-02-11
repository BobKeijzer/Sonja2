"use client"

import { useState, useEffect } from "react"
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  X,
  Eye,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ThinkingSteps } from "@/components/thinking-steps"
import type { Competitor, ThinkingStep } from "@/lib/types"
import {
  getCompetitors,
  addCompetitor as apiAddCompetitor,
  deleteCompetitor as apiDeleteCompetitor,
  analyzeCompetitors,
} from "@/lib/api"

const DEFAULT_PROMPT = `Gebruik de spy_competitor_research tool voor elk van de geselecteerde concurrenten.

Voor elke concurrent:
- Roep spy_competitor_research aan met de naam van de concurrent
- Sla de belangrijkste bevindingen op

Geef daarna per concurrent een samenvatting (recente ontwikkelingen, sterke punten, marktpositie) en sluit af met concrete actiepunten voor AFAS marketing op basis van de gecombineerde analyse.`

export function CompetitorsScreen() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [steps, setSteps] = useState<ThinkingStep[]>([])
  const [loading, setLoading] = useState(true)
  const [showPromptEdit, setShowPromptEdit] = useState(false)
  const [customPrompt, setCustomPrompt] = useState("")

  // Load from backend
  useEffect(() => {
    getCompetitors()
      .then(setCompetitors)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    try {
      const newComp = await apiAddCompetitor(newName.trim())
      setCompetitors((prev) => [...prev, newComp])
    } catch { /* ignore */ }
    setNewName("")
    setShowAddForm(false)
  }

  const handleDelete = async (id: string) => {
    try {
      await apiDeleteCompetitor(id)
      setCompetitors((prev) => prev.filter((c) => c.id !== id))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch { /* ignore */ }
  }

  const handleAnalyze = async () => {
    if (selected.size === 0) return
    setIsAnalyzing(true)
    setAnalysisResult(null)
    setSteps([])

    const selectedNames = competitors
      .filter((c) => selected.has(c.id))
      .map((c) => c.name)

    try {
      const data = await analyzeCompetitors(selectedNames, customPrompt.trim() || undefined)
      setSteps(data.steps)
      setAnalysisResult(data.response)
    } catch {
      setAnalysisResult("Er ging iets mis bij de analyse. Probeer het opnieuw.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Concurrenten
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Beheer en analyseer concurrenten van AFAS
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-transparent"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="h-4 w-4" />
              Nieuwe concurrent
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-transparent"
              onClick={() => setShowPromptEdit(!showPromptEdit)}
            >
              <Settings className="h-4 w-4" />
              Prompt
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleAnalyze}
              disabled={selected.size === 0 || isAnalyzing}
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Analyseer ({selected.size})
            </Button>
          </div>
        </div>

        {/* Prompt editor */}
        {showPromptEdit && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold text-card-foreground">
                  Analyse prompt (optioneel)
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCustomPrompt("")}
                >
                  Reset naar standaard
                </Button>
              </div>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={DEFAULT_PROMPT}
                rows={6}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-2 text-[10px] text-muted-foreground">
                Laat leeg voor de standaard prompt. De geselecteerde concurrenten worden automatisch toegevoegd.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Add form */}
        {showAddForm && (
          <Card className="mb-4">
            <CardContent className="flex items-center gap-3 p-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Naam van de concurrent"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd()
                }}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
                Toevoegen
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setShowAddForm(false)
                  setNewName("")
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Competitors table */}
        <Card>
          <CardContent className="p-0">
            {competitors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Eye className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  Nog geen concurrenten toegevoegd
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Header */}
                <div className="flex items-center gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <div className="w-8" />
                  <div className="flex-1">Naam</div>
                  <div className="w-10" />
                </div>
                {competitors.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="w-8">
                      <Checkbox
                        checked={selected.has(comp.id)}
                        onCheckedChange={() => toggleSelect(comp.id)}
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-card-foreground">
                        {comp.name}
                      </span>
                    </div>
                    <div className="w-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(comp.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Verwijder {comp.name}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis results */}
        {analysisResult && !isAnalyzing && (
          <Card className="mt-6">
            <CardContent className="p-5">
              <ThinkingSteps steps={steps} defaultOpen />
              <div className="mt-3 rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-card-foreground">
                {analysisResult.split("\n").map((line, i) => (
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
                    {i < analysisResult.split("\n").length - 1 && <br />}
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
