"use client"

import { useState, useEffect } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  Mail,
  RepeatIcon,
  CalendarDays,
  X,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AgendaItem } from "@/lib/types"
import {
  getAgendaItems,
  createAgendaItem,
  updateAgendaItem,
  deleteAgendaItem,
} from "@/lib/api"

export function AgendaScreen() {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null)

  const [formTitle, setFormTitle] = useState("")
  const [formPrompt, setFormPrompt] = useState("")
  const [formType, setFormType] = useState<"once" | "recurring">("once")
  const [formSchedule, setFormSchedule] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formEmails, setFormEmails] = useState<string[]>([])

  // Load from backend
  useEffect(() => {
    getAgendaItems()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const resetForm = () => {
    setFormTitle("")
    setFormPrompt("")
    setFormType("once")
    setFormSchedule("")
    setFormEmail("")
    setFormEmails([])
    setEditingItem(null)
  }

  const openNew = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (item: AgendaItem) => {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormPrompt(item.prompt)
    setFormType(item.type)
    setFormSchedule(item.schedule)
    setFormEmails(item.mail_to)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formPrompt.trim()) return

    if (editingItem) {
      try {
        const updated = await updateAgendaItem(editingItem.id, {
          title: formTitle,
          prompt: formPrompt,
          type: formType,
          schedule: formSchedule,
          mail_to: formEmails,
        })
        setItems((prev) =>
          prev.map((item) => (item.id === editingItem.id ? updated : item))
        )
      } catch { /* ignore */ }
    } else {
      try {
        const created = await createAgendaItem({
          title: formTitle,
          prompt: formPrompt,
          type: formType,
          schedule: formSchedule,
          mail_to: formEmails,
        })
        setItems((prev) => [...prev, created])
      } catch { /* ignore */ }
    }
    setShowModal(false)
    resetForm()
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAgendaItem(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch { /* ignore */ }
  }

  const addEmail = () => {
    if (formEmail.trim() && !formEmails.includes(formEmail.trim())) {
      setFormEmails((prev) => [...prev, formEmail.trim()])
      setFormEmail("")
    }
  }

  const removeEmail = (email: string) => {
    setFormEmails((prev) => prev.filter((e) => e !== email))
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

        {items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Nog geen agenda items
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Maak een nieuw item aan om Sonja automatisch taken te laten uitvoeren.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-card-foreground truncate">
                        {item.title}
                      </h3>
                      <Badge
                        variant={item.type === "recurring" ? "default" : "secondary"}
                        className="shrink-0 text-[10px]"
                      >
                        {item.type === "recurring" ? (
                          <RepeatIcon className="mr-1 h-3 w-3" />
                        ) : null}
                        {item.type === "recurring" ? "Terugkerend" : "Eenmalig"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {item.prompt}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.schedule}
                      </span>
                      {item.mail_to.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {item.mail_to.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Bewerk</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Verwijder</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
                <textarea
                  id="agenda-prompt"
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="Wat moet Sonja doen?"
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
                <input
                  id="agenda-schedule"
                  type="text"
                  value={formSchedule}
                  onChange={(e) => setFormSchedule(e.target.value)}
                  placeholder={formType === "recurring" ? "Cron: 0 9 * * 1-5" : "ISO: 2026-04-27T08:00:00"}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-card-foreground">
                  Email ontvangers
                </span>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addEmail()
                      }
                    }}
                    placeholder="email@voorbeeld.nl"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEmail}
                  >
                    Toevoegen
                  </Button>
                </div>
                {formEmails.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {formEmails.map((email) => (
                      <Badge
                        key={email}
                        variant="secondary"
                        className="gap-1 pr-1 text-xs"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => removeEmail(email)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
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
