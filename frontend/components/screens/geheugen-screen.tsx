"use client"

import { useState, useEffect } from "react"
import { Brain, Pencil, Trash2, Loader2, X, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getMemoryFiles,
  getMemoryContent,
  updateMemoryFile,
  deleteMemoryFile,
} from "@/lib/api"

type GeheugenScreenProps = { isActive?: boolean }

export function GeheugenScreen({ isActive }: GeheugenScreenProps) {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [openFilename, setOpenFilename] = useState<string | null>(null)
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const loadFiles = () => {
    setLoading(true)
    getMemoryFiles()
      .then(setFiles)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadFiles()
  }, [])

  // Vernieuw lijst wanneer dit scherm weer zichtbaar wordt (bijv. na write_to_memory in chat)
  useEffect(() => {
    if (isActive) loadFiles()
  }, [isActive])

  useEffect(() => {
    if (!openFilename) {
      setContent("")
      return
    }
    getMemoryContent(openFilename)
      .then(setContent)
      .catch(() => setContent(""))
  }, [openFilename])

  const handleSave = async () => {
    if (openFilename == null) return
    setSaving(true)
    try {
      await updateMemoryFile(openFilename, content)
      setOpenFilename(null)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (filename: string) => {
    try {
      await deleteMemoryFile(filename)
      if (openFilename === filename) setOpenFilename(null)
      setDeleteTarget(null)
      loadFiles()
    } catch {
      // ignore
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
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Geheugen</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sonja slaat op basis van jullie interacties herinneringen op en groeit zo met je mee.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => loadFiles()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Vernieuwen
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Brain className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nog geen herinneringen. Sonja slaat ze hier op tijdens gesprekken.
                </p>
              </div>
            ) : (
              <ul>
                {files.map((filename) => (
                  <li
                    key={filename}
                    className="border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-3 text-left"
                        onClick={() =>
                          setOpenFilename(openFilename === filename ? null : filename)
                        }
                      >
                        <Brain className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground truncate">
                          {filename}
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            setOpenFilename(openFilename === filename ? null : filename)
                          }
                          title="Bewerken"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(filename)}
                          title="Verwijderen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {openFilename === filename && (
                      <div className="border-t border-border bg-muted/20 px-4 py-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            {filename}
                          </span>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSave} disabled={saving}>
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Opslaan"
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setOpenFilename(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          rows={12}
                          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Herinnering verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je &quot;{deleteTarget}&quot; wilt verwijderen? De zoekindex wordt automatisch bijgewerkt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
