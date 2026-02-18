"use client"

import { useState, useEffect, Fragment } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  RepeatIcon,
  CalendarDays,
  X,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MarkdownContent } from "@/components/markdown-content"
import { ThinkingSteps } from "@/components/thinking-steps"
import type { AgendaItem } from "@/lib/types"
import {
  getAgendaItems,
  addEmojis,
  createAgendaItem,
  updateAgendaItem,
  deleteAgendaItem,
} from "@/lib/api"

function formatRunAt(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    return d.toLocaleString("nl-NL", {
      dateStyle: "short",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export function AgendaScreen() {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [formTitle, setFormTitle] = useState("")
  const [formPrompt, setFormPrompt] = useState("")
  const [formType, setFormType] = useState<"once" | "recurring">("once")
  const [formSchedule, setFormSchedule] = useState("")
  const [scheduleError, setScheduleError] = useState("")

  const refresh = () => {
    getAgendaItems().then(setItems).catch(() => {})
  }

  // Load + poll elke 60s (zelfde ritme als scheduler get_due_items)
  useEffect(() => {
    getAgendaItems().then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [])

  const resetForm = () => {
    setFormTitle("")
    setFormPrompt("")
    setFormType("once")
    setFormSchedule("")
    setScheduleError("")
    setEditingItem(null)
  }

  const openNew = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (e: React.MouseEvent, item: AgendaItem) => {
    e.stopPropagation()
    setEditingItem(item)
    setFormTitle(item.title)
    setFormPrompt(item.prompt)
    setFormType(item.type)
    setFormSchedule(item.schedule)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formPrompt.trim()) return
    setScheduleError("")
    if (!formSchedule.trim()) {
      setScheduleError(
        formType === "once"
          ? "Vul een datum en tijd in (bijv. 2026-04-27T08:00:00)."
          : "Vul een cron-expressie in (bijv. 0 9 * * 1-5 voor wekelijks ma–vr 09:00)."
      )
      return
    }

    if (editingItem) {
      try {
        await updateAgendaItem(editingItem.id, {
          title: formTitle,
          prompt: formPrompt,
          type: formType,
          schedule: formSchedule,
        })
        refresh()
      } catch { /* ignore */ }
    } else {
      try {
        await createAgendaItem({
          title: formTitle,
          prompt: formPrompt,
          type: formType,
          schedule: formSchedule,
        })
        refresh()
      } catch { /* ignore */ }
    }
    setShowModal(false)
    resetForm()
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await deleteAgendaItem(id)
      refresh()
      if (expandedId === id) setExpandedId(null)
    } catch { /* ignore */ }
  }

  const sortedItems = [...items].sort((a, b) => {
    const da = a.last_run_at || a.created_at || ""
    const db = b.last_run_at || b.created_at || ""
    return new Date(db).getTime() - new Date(da).getTime()
  })

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
            <h1 className="text-xl font-semibold text-foreground">Agenda</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Plan terugkerende en eenmalige taken voor Sonja
            </p>
          </div>
          <Button onClick={openNew} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nieuw item
          </Button>
        </div>

        {/* Eén lijst taken: sorteer op last_run_at (meest recent bovenaan), anders created_at. Klik om uit te klappen. */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Taken
          </h2>
          {sortedItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nog geen agenda items. Maak een nieuw item om Sonja automatisch taken te laten uitvoeren.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-foreground">
                      Laatst uitgevoerd
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-foreground">
                      Titel
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-foreground hidden sm:table-cell">
                      Type
                    </th>
                    <th className="w-20 px-3 py-2 text-right font-medium text-foreground">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => (
                    <Fragment key={item.id}>
                      <tr
                        className={`border-b border-border last:border-b-0 hover:bg-muted/30 cursor-pointer ${expandedId === item.id ? "bg-muted/40" : ""}`}
                        onClick={() => setExpandedId((id) => (id === item.id ? null : item.id))}
                      >
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {formatRunAt(item.last_run_at ?? null)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-card-foreground">{item.title}</span>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {item.prompt}
                          </p>
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <Badge
                            variant={item.type === "recurring" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {item.type === "recurring" ? (
                              <RepeatIcon className="mr-1 h-2.5 w-2.5 inline" />
                            ) : null}
                            {item.type === "recurring" ? "Terugkerend" : "Eenmalig"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => openEdit(e, item)}
                            >
                              <Pencil className="h-3 w-3" />
                              <span className="sr-only">Bewerk</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => handleDelete(e, item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span className="sr-only">Verwijder</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === item.id && (
                        <tr className="border-b border-border bg-muted/20">
                          <td colSpan={4} className="px-3 py-3">
                            <div className="space-y-3 text-sm">
                              {item.last_run_at ? (
                                <>
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Laatste run: {formatRunAt(item.last_run_at)}
                                  </p>
                                  {(item.last_run_steps?.length ?? 0) > 0 && (
                                    <div className="mt-2">
                                      <ThinkingSteps
                                        steps={addEmojis(item.last_run_steps ?? [])}
                                        defaultOpen
                                      />
                                    </div>
                                  )}
                                  {item.last_run_response && (
                                    <div className="mt-2">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Antwoord Sonja</p>
                                      <div className="rounded-md bg-background/80 p-3 text-card-foreground [&_.markdown-content]:text-sm">
                                        <MarkdownContent content={item.last_run_response} />
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <p className="text-muted-foreground">Nog niet uitgevoerd.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">
                {editingItem ? "Item bewerken" : "Nieuw agenda item"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="agenda-title"
                  className="mb-1 block text-xs font-medium text-card-foreground"
                >
                  Titel
                </label>
                <input
                  id="agenda-title"
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Bijv. Wekelijkse concurrent-analyse"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label
                  htmlFor="agenda-prompt"
                  className="mb-1 block text-xs font-medium text-card-foreground"
                >
                  Prompt
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Beschrijf de opdracht. Voor e-mail: vermeld in de tekst (bijv. &quot;mail het resultaat naar jan@voorbeeld.nl&quot;).
                </p>
                <textarea
                  id="agenda-prompt"
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="Wat moet Sonja doen? Optioneel: mail het resultaat naar ..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <span className="mb-2 block text-xs font-medium text-card-foreground">
                  Type
                </span>
                <div className="flex gap-3">
                  {(["once", "recurring"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormType(type)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        formType === type
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {type === "recurring" ? "Terugkerend" : "Eenmalig"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="agenda-schedule"
                  className="mb-1 block text-xs font-medium text-card-foreground"
                >
                  Planning
                </label>
                {formType === "once" ? (
                  <>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Eenmalige taak: vul datum en tijd in (Europe/Amsterdam). Formaat: <code className="rounded bg-muted px-1">YYYY-MM-DDTHH:MM:00</code>, bijv. 2026-04-27T08:00:00 voor 27 april 2026 om 08:00.
                    </p>
                    <input
                      id="agenda-schedule"
                      type="text"
                      value={formSchedule}
                      onChange={(e) => {
                        setFormSchedule(e.target.value)
                        setScheduleError("")
                      }}
                      placeholder="2026-04-27T08:00:00"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Terugkerende taak: vul een cron-expressie in. Vijf velden: minuut uur dag maand weekdag. Voorbeelden: <code className="rounded bg-muted px-1">0 9 * * *</code> = dagelijks 09:00, <code className="rounded bg-muted px-1">0 9 * * 1-5</code> = ma–vr 09:00, <code className="rounded bg-muted px-1">*/15 * * * *</code> = elke 15 min.
                    </p>
                    <input
                      id="agenda-schedule"
                      type="text"
                      value={formSchedule}
                      onChange={(e) => {
                        setFormSchedule(e.target.value)
                        setScheduleError("")
                      }}
                      placeholder="0 9 * * 1-5"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </>
                )}
                {scheduleError && (
                  <p className="mt-1 text-xs text-destructive">{scheduleError}</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
              >
                Annuleren
              </Button>
              <Button onClick={handleSave} disabled={!formTitle.trim() || !formPrompt.trim()}>
                {editingItem ? "Opslaan" : "Aanmaken"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
