"use client"

import { useState, useRef, useEffect } from "react"
import {
  Newspaper,
  Settings,
  Rss,
  Loader2,
  Copy,
  X,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MarkdownContent } from "@/components/markdown-content"
import { SonjaAvatar } from "@/components/sonja-avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { NewsItem, ThinkingStep } from "@/lib/types"
import {
  getNewsItems,
  getNewsFeeds,
  updateNewsFeeds,
  getNewsPrompts,
  updateNewsPrompts,
  generateNewsContentStream,
  type NewsPrompts,
  type NewsGenerateTask,
} from "@/lib/api"
import { ThinkingSteps } from "@/components/thinking-steps"

const EIGEN_PLACEHOLDER =
  "Bijv. Schrijf een Twitter-draad van 3 tweets over dit nieuws voor AFAS, of een korte nieuwsbrief-snippet (2-3 zinnen) voor onze B2B-nieuwsbrief."

export function NewsScreen() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPrompts, setShowPrompts] = useState(false)
  const [showFeeds, setShowFeeds] = useState(false)
  const [prompts, setPrompts] = useState<NewsPrompts | null>(null)
  const [feeds, setFeeds] = useState<string[]>([])
  const [resultModal, setResultModal] = useState<{ content: string; title: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [pendingSteps, setPendingSteps] = useState<ThinkingStep[]>([])
  const [customPrompt, setCustomPrompt] = useState("")
  const [customItem, setCustomItem] = useState<NewsItem | null>(null)
  const [copied, setCopied] = useState(false)
  const [resultModalAvatar, setResultModalAvatar] = useState<"blij" | "koffie">("blij")
  const koffieTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!resultModal) return
    setResultModalAvatar("blij")
    if (koffieTimeoutRef.current) clearTimeout(koffieTimeoutRef.current)
    koffieTimeoutRef.current = setTimeout(() => setResultModalAvatar("koffie"), 3000)
    return () => {
      if (koffieTimeoutRef.current) clearTimeout(koffieTimeoutRef.current)
    }
  }, [resultModal])

  const loadNews = () => {
    getNewsItems()
      .then(({ items: list, last_updated }) => {
        setItems(list)
        setLastUpdated(last_updated ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadNews()
  }, [])

  useEffect(() => {
    if (showPrompts) {
      getNewsPrompts().then(setPrompts)
    }
  }, [showPrompts])

  useEffect(() => {
    if (showFeeds) {
      getNewsFeeds().then(setFeeds)
    }
  }, [showFeeds])

  const handleSavePrompts = async () => {
    if (!prompts) return
    try {
      await updateNewsPrompts(prompts)
      setShowPrompts(false)
    } catch {
      // ignore
    }
  }

  const handleSaveFeeds = async () => {
    try {
      await updateNewsFeeds(feeds.filter((u) => u.trim()))
      setShowFeeds(false)
      loadNews()
    } catch {
      // ignore
    }
  }

  const handleGenerate = async (
    item: NewsItem,
    task: NewsGenerateTask,
    custom?: string
  ) => {
    setGenerating(true)
    setResultModal(null)
    setPendingSteps([])
    try {
      const { content } = await generateNewsContentStream(
        item,
        task,
        task === "custom" ? custom : undefined,
        (step) => setPendingSteps((prev) => [...prev, step])
      )
      setResultModal({ content, title: item.title })
    } catch {
      setResultModal({
        content: "Genereren mislukt. Probeer het opnieuw.",
        title: item.title,
      })
    } finally {
      setPendingSteps([])
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!resultModal) return
    navigator.clipboard.writeText(resultModal.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Nieuws</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              RSS-feeds – genereer inhakers, LinkedIn of betekenis voor AFAS
            </p>
            {lastUpdated && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Laatst bijgewerkt: {new Date(lastUpdated).toLocaleString("nl-NL")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowPrompts(true)}
            >
              <Settings className="h-4 w-4" />
              Instellingen
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowFeeds(true)}
            >
              <Rss className="h-4 w-4" />
              Feeds
            </Button>
            <Button size="sm" onClick={loadNews}>
              Vernieuwen
            </Button>
          </div>
        </div>

        {/* Generating: dynamische stappen */}
        {generating && (
          <Card className="mb-6">
            <CardContent className="flex flex-col items-center py-6">
              <SonjaAvatar mood="denken" size="lg" alt="Sonja" />
              <p className="mt-2 text-sm text-muted-foreground">
                Sonja is aan het schrijven...
              </p>
              {pendingSteps.length > 0 && (
                <div className="mt-4 w-full max-w-xl">
                  <ThinkingSteps steps={pendingSteps} defaultOpen />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Prompts modal */}
        {showPrompts && prompts && (
          <Dialog open onOpenChange={setShowPrompts}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Standaardprompts</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Inhaker</label>
                  <textarea
                    value={prompts.inhaker}
                    onChange={(e) => setPrompts((p) => p ? { ...p, inhaker: e.target.value } : p)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">LinkedIn</label>
                  <textarea
                    value={prompts.linkedin}
                    onChange={(e) => setPrompts((p) => p ? { ...p, linkedin: e.target.value } : p)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Betekenis voor AFAS</label>
                  <textarea
                    value={prompts.afas_betekenis}
                    onChange={(e) =>
                      setPrompts((p) => p ? { ...p, afas_betekenis: e.target.value } : p)
                    }
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <Button onClick={handleSavePrompts}>Opslaan</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Feeds modal */}
        {showFeeds && (
          <Dialog open onOpenChange={setShowFeeds}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>RSS-feeds</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {feeds.map((url, i) => (
                  <input
                    key={i}
                    type="url"
                    value={url}
                    onChange={(e) =>
                      setFeeds((prev) => {
                        const next = [...prev]
                        next[i] = e.target.value
                        return next
                      })
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    placeholder="https://..."
                  />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFeeds((prev) => [...prev, ""])}
                >
                  + Feed toevoegen
                </Button>
                <Button onClick={handleSaveFeeds}>Opslaan</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* News list */}
        <div className="space-y-4">
          {items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Newspaper className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Geen nieuws. Voeg feeds toe onder Feeds of vernieuw.
                </p>
              </CardContent>
            </Card>
          ) : (
            items.map((item, idx) => (
              <Card key={idx}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {item.image_url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <img
                          src={item.image_url}
                          alt=""
                          className="h-24 w-36 rounded object-cover"
                        />
                      </a>
                    )}
                    <div className="min-w-0 flex-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:underline"
                      >
                        {item.title}
                      </a>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.source}
                        {item.published_at && ` · ${new Date(item.published_at).toLocaleDateString("nl-NL")}`}
                      </p>
                      {item.summary && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {item.summary}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={generating}
                          onClick={() => handleGenerate(item, "inhaker")}
                        >
                          Inhaker
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={generating}
                          onClick={() => handleGenerate(item, "linkedin")}
                        >
                          LinkedIn
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={generating}
                          onClick={() => handleGenerate(item, "afas_betekenis")}
                        >
                          Betekenis voor AFAS
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={generating}
                          onClick={() => setCustomItem(item)}
                        >
                          Eigen prompt
                        </Button>
                      </div>
                      {customItem?.url === item.url && (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                          <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder={EIGEN_PLACEHOLDER}
                            rows={2}
                            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={generating || !customPrompt.trim()}
                              onClick={() =>
                                handleGenerate(item, "custom", customPrompt.trim())
                              }
                            >
                              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Genereer"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setCustomItem(null)
                                setCustomPrompt("")
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Result modal */}
        {resultModal && (
          <Dialog open onOpenChange={(open) => !open && setResultModal(null)}>
            <DialogContent
              hideCloseButton
              className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden min-w-0"
            >
              <div className="mb-3 flex items-center gap-2">
                <SonjaAvatar mood={resultModalAvatar} size="sm" alt="Sonja" />
                {resultModalAvatar === "blij" && (
                  <span className="text-sm text-muted-foreground">Klaar!</span>
                )}
              </div>
              <DialogHeader>
                <DialogTitle className="break-words pr-0">{resultModal.title}</DialogTitle>
              </DialogHeader>
              <div className="min-w-0 overflow-x-hidden rounded-lg border bg-muted/30 p-4 [&_.markdown-content]:break-words">
                <MarkdownContent content={resultModal.content} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Gekopieerd" : "Kopiëren"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResultModal(null)}
                >
                  Sluiten
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
