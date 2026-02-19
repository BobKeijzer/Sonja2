"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Moon, LayoutGrid, Bell, FileText, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { getCallTranscriptFiles, uploadCallTranscriptFile } from "@/lib/api"

interface SettingsState {
  darkMode: boolean
  stepsOpen: boolean
  showSuggestions: boolean
}

function getInitialSettings(): SettingsState {
  // Default settings -- will be overwritten by localStorage on client
  return {
    darkMode: false,
    stepsOpen: false,
    showSuggestions: true,
  }
}

export function SettingsScreen() {
  const [settings, setSettings] = useState<SettingsState>(getInitialSettings)
  const [hydrated, setHydrated] = useState(false)
  const [transcriptFiles, setTranscriptFiles] = useState<string[]>([])
  const [transcriptUploading, setTranscriptUploading] = useState(false)
  const transcriptInputRef = useRef<HTMLInputElement>(null)

  // Load saved settings on mount (once)
  useEffect(() => {
    const saved = localStorage.getItem("sonja-settings")
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SettingsState
        setSettings(parsed)
        // Immediately apply dark mode from saved state
        if (parsed.darkMode) {
          document.documentElement.classList.add("dark")
        } else {
          document.documentElement.classList.remove("dark")
        }
      } catch {
        // ignore
      }
    }
    setHydrated(true)
  }, [])

  const loadTranscriptFiles = useCallback(() => {
    getCallTranscriptFiles()
      .then(setTranscriptFiles)
      .catch(() => setTranscriptFiles([]))
  }, [])

  useEffect(() => {
    if (hydrated) loadTranscriptFiles()
  }, [hydrated, loadTranscriptFiles])

  const handleTranscriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setTranscriptUploading(true)
    try {
      await uploadCallTranscriptFile(file)
      loadTranscriptFiles()
    } catch {
      // ignore
    } finally {
      setTranscriptUploading(false)
      e.target.value = ""
    }
  }

  // Persist and apply dark mode on change (only after hydration)
  const updateSetting = useCallback(
    (key: keyof SettingsState, value: boolean) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value }
        localStorage.setItem("sonja-settings", JSON.stringify(next))
        if (key === "darkMode") {
          if (value) {
            document.documentElement.classList.add("dark")
          } else {
            document.documentElement.classList.remove("dark")
          }
        }
        return next
      })
    },
    []
  )

  // Don't render toggles until we know the actual saved state
  if (!hydrated) {
    return (
      <div className="h-full overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-foreground">
              Instellingen
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pas het gedrag en uiterlijk van Sonja aan
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">
            Instellingen
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pas het gedrag en uiterlijk van Sonja aan
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Theme */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Moon className="h-4 w-4" />
                Thema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Dark mode
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Schakel over naar een donker thema
                  </p>
                </div>
                <Switch
                  checked={settings.darkMode}
                  onCheckedChange={(v) => updateSetting("darkMode", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Interface */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <LayoutGrid className="h-4 w-4" />
                Interface
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Stappen standaard open
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Toon Sonja&apos;s stappen automatisch bij elk antwoord
                  </p>
                </div>
                <Switch
                  checked={settings.stepsOpen}
                  onCheckedChange={(v) => updateSetting("stepsOpen", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Suggestiekaarten tonen
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Toon suggestiekaarten in de chat
                  </p>
                </div>
                <Switch
                  checked={settings.showSuggestions}
                  onCheckedChange={(v) =>
                    updateSetting("showSuggestions", v)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Call transcripts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Call transcripts
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Upload .md of .txt bestanden met gesprekstranscripts. Sonja kan ze ophalen via de tool get_call_transcripts (handig bij Docker).
              </p>
              <input
                ref={transcriptInputRef}
                type="file"
                accept=".md,.txt"
                className="hidden"
                onChange={handleTranscriptUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={transcriptUploading}
                onClick={() => transcriptInputRef.current?.click()}
                className="w-fit"
              >
                <Upload className="mr-2 h-4 w-4" />
                {transcriptUploading ? "Bezig…" : "Bestand uploaden"}
              </Button>
              {transcriptFiles.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                  {transcriptFiles.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4" />
                Notificaties
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Email notificaties
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ontvang meldingen wanneer Sonja een taak heeft afgerond
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    Binnenkort
                  </Badge>
                  <Switch disabled checked={false} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Browser notificaties
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ontvang push notificaties in je browser
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    Binnenkort
                  </Badge>
                  <Switch disabled checked={false} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
