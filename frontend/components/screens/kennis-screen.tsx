"use client"

import { useState, useEffect, useRef } from "react"
import {
  FileText,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
} from "lucide-react"
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
  getKnowledgeFiles,
  getKnowledgeContent,
  uploadKnowledgeFile,
  createKnowledgeFile,
  updateKnowledgeFile,
  deleteKnowledgeFile,
} from "@/lib/api"

export function KennisScreen() {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [openFilename, setOpenFilename] = useState<string | null>(null)
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [newDocName, setNewDocName] = useState("")
  const [newDocContent, setNewDocContent] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFiles = () => {
    getKnowledgeFiles()
      .then(setFiles)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadFiles()
  }, [])

  useEffect(() => {
    if (!openFilename) {
      setContent("")
      return
    }
    getKnowledgeContent(openFilename)
      .then(setContent)
      .catch(() => setContent(""))
  }, [openFilename])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadKnowledgeFile(file)
      loadFiles()
    } catch {
      // ignore
    }
    e.target.value = ""
  }

  const handleSave = async () => {
    if (openFilename == null) return
    setSaving(true)
    try {
      await updateKnowledgeFile(openFilename, content)
      setOpenFilename(null)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    const name = newDocName.trim().endsWith(".md") || newDocName.trim().endsWith(".txt")
      ? newDocName.trim()
      : `${newDocName.trim()}.md`
    if (!name) return
    try {
      await createKnowledgeFile(name, newDocContent)
      loadFiles()
      setShowNewDoc(false)
      setNewDocName("")
      setNewDocContent("")
    } catch {
      // ignore
    }
  }

  const handleDelete = async (filename: string) => {
    try {
      await deleteKnowledgeFile(filename)
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Kennis</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Voeg hier teksten toe die Sonja kan gebruiken als kennis, zodat ze meer context heeft in het gesprek. Tip: geef bestanden een naam die goed aansluit op de inhoud — dan vindt Sonja precies wat ze nodig heeft.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => setShowNewDoc(true)}
            >
              <Plus className="h-4 w-4" />
              Nieuw document
            </Button>
          </div>
        </div>

        {/* New document form */}
        {showNewDoc && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <input
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="Bestandsnaam (bijv. notities.md)"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
                placeholder="Inhoud (optioneel)"
                rows={4}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={!newDocName.trim()}>
                  Aanmaken
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewDoc(false)
                    setNewDocName("")
                    setNewDocContent("")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* File list */}
        <Card>
          <CardContent className="p-0">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nog geen bestanden. Upload een .md/.txt of maak een nieuw document.
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
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
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
            <AlertDialogTitle>Bestand verwijderen?</AlertDialogTitle>
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
