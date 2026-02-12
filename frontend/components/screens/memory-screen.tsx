"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Brain,
  FileText,
  Trash2,
  Upload,
  Plus,
  Pencil,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getKnowledgeFiles,
  getKnowledgeContent,
  uploadKnowledgeFile,
  createKnowledgeFile,
  updateKnowledgeFile,
  deleteKnowledgeFile,
} from "@/lib/api"

interface FileEntry {
  name: string
  content?: string
  loadingContent?: boolean
}

export function MemoryScreen() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [expandedName, setExpandedName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [newDocName, setNewDocName] = useState("")
  const [newDocContent, setNewDocContent] = useState("")
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load file list from backend
  useEffect(() => {
    getKnowledgeFiles()
      .then((names) => setFiles(names.map((n) => ({ name: n }))))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (name: string) => {
    if (expandedName === name) {
      setExpandedName(null)
      return
    }
    setExpandedName(name)
    // Load content if not loaded yet
    const file = files.find((f) => f.name === name)
    if (file && file.content === undefined) {
      setFiles((prev) =>
        prev.map((f) => (f.name === name ? { ...f, loadingContent: true } : f))
      )
      try {
        const content = await getKnowledgeContent(name)
        setFiles((prev) =>
          prev.map((f) =>
            f.name === name ? { ...f, content, loadingContent: false } : f
          )
        )
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.name === name
              ? { ...f, content: "Kon inhoud niet laden.", loadingContent: false }
              : f
          )
        )
      }
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadKnowledgeFile(file)
      // Refresh list
      const names = await getKnowledgeFiles()
      setFiles(names.map((n) => ({ name: n })))
    } catch { /* ignore */ }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleCreateDoc = async () => {
    if (!newDocName.trim() || !newDocContent.trim()) return
    try {
      await createKnowledgeFile(newDocName.trim(), newDocContent.trim())
      const names = await getKnowledgeFiles()
      setFiles(names.map((n) => ({ name: n })))
      setNewDocName("")
      setNewDocContent("")
      setShowNewDoc(false)
    } catch { /* ignore */ }
  }

  const startEdit = (name: string) => {
    setExpandedName(name)
    const file = files.find((f) => f.name === name)
    if (file?.content !== undefined) {
      setEditingName(name)
      setEditingContent(file.content)
    } else {
      setFiles((prev) =>
        prev.map((f) => (f.name === name ? { ...f, loadingContent: true } : f))
      )
      getKnowledgeContent(name)
        .then((content) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.name === name ? { ...f, content, loadingContent: false } : f
            )
          )
          setEditingName(name)
          setEditingContent(content)
        })
        .catch(() => {
          setFiles((prev) =>
            prev.map((f) =>
              f.name === name ? { ...f, loadingContent: false } : f
            )
          )
          setEditingName(name)
          setEditingContent("")
        })
    }
  }

  const cancelEdit = () => {
    setEditingName(null)
    setEditingContent("")
  }

  const handleSaveEdit = async () => {
    if (!editingName) return
    setSavingEdit(true)
    try {
      await updateKnowledgeFile(editingName, editingContent)
      setFiles((prev) =>
        prev.map((f) => (f.name === editingName ? { ...f, content: editingContent } : f))
      )
      setEditingName(null)
      setEditingContent("")
    } catch { /* ignore */ }
    finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (name: string) => {
    try {
      await deleteKnowledgeFile(name)
      setFiles((prev) => prev.filter((f) => f.name !== name))
      if (expandedName === name) setExpandedName(null)
      if (editingName === name) cancelEdit()
    } catch { /* ignore */ }
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
            <h1 className="text-xl font-semibold text-foreground">Geheugen</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bestanden en kennis die Sonja gebruikt als context
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              accept=".md,.txt"
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
            <Button
              size="sm"
              className="gap-2"
              onClick={() => setShowNewDoc(!showNewDoc)}
            >
              <Plus className="h-4 w-4" />
              Nieuw document
            </Button>
          </div>
        </div>

        {/* New document form */}
        {showNewDoc && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-card-foreground">
                  Nieuw document
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowNewDoc(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="Bestandsnaam (bijv. notities.md)"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <textarea
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder="Inhoud van het document..."
                  rows={5}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleCreateDoc}
                    disabled={!newDocName.trim() || !newDocContent.trim()}
                  >
                    Opslaan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Files list */}
        {files.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Brain className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Nog geen bestanden in het geheugen
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload bestanden of maak documenten aan die Sonja als context
                kan gebruiken.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {files.map((file) => {
              const isExpanded = expandedName === file.name
              const isMemory = file.name === "memory.md"
              return (
                <Card
                  key={file.name}
                  className={isMemory ? "ring-1 ring-primary/20" : ""}
                >
                  <CardContent className="p-0">
                    <div
                      onClick={() => handleToggle(file.name)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isMemory ? "bg-primary/10" : "bg-muted"}`}
                      >
                        {isMemory ? (
                          <Brain className="h-4 w-4 text-primary" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-card-foreground">
                          {file.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(file.name)
                          }}
                          title="Bewerken"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Bewerk {file.name}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(file.name)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Verwijder {file.name}</span>
                        </Button>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3">
                        {editingName === file.name ? (
                          <div className="flex flex-col gap-3">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              rows={12}
                              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                              placeholder="Inhoud van het bestand..."
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={savingEdit}
                              >
                                Annuleren
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                              >
                                {savingEdit ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Opslaan"
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : file.loadingContent ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              Laden...
                            </span>
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {file.content ?? ""}
                          </pre>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
