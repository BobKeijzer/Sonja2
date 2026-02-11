"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Brain,
  FileText,
  Trash2,
  Upload,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getKnowledgeFiles,
  getKnowledgeContent,
  uploadKnowledgeFile,
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

  const handleDelete = async (name: string) => {
    try {
      await deleteKnowledgeFile(name)
      setFiles((prev) => prev.filter((f) => f.name !== name))
      if (expandedName === name) setExpandedName(null)
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
          </div>
        </div>

        {/* Files list */}
        {files.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Brain className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Nog geen bestanden in het geheugen
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload bestanden (.md of .txt) die Sonja als context kan
                gebruiken.
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
                        {file.loadingContent ? (
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
