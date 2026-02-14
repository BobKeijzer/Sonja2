"use client"

import React from "react"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChatScreen } from "@/components/screens/chat-screen"
import { AgendaScreen } from "@/components/screens/agenda-screen"
import { MeetingsScreen } from "@/components/screens/meetings-screen"
import { WebsiteScreen } from "@/components/screens/website-screen"
import { CompetitorsScreen } from "@/components/screens/competitors-screen"
import { NewsScreen } from "@/components/screens/news-screen"
import { KennisScreen } from "@/components/screens/kennis-screen"
import { GeheugenScreen } from "@/components/screens/geheugen-screen"
import { CvScreen } from "@/components/screens/cv-screen"
import { SettingsScreen } from "@/components/screens/settings-screen"
import type { ScreenId } from "@/lib/types"

type ScreenProps = { isActive?: boolean }
const screens: Record<ScreenId, React.ComponentType<ScreenProps>> = {
  chat: ChatScreen,
  agenda: AgendaScreen,
  vergaderingen: MeetingsScreen,
  website: WebsiteScreen,
  concurrenten: CompetitorsScreen,
  nieuws: NewsScreen,
  cv: CvScreen,
  kennis: KennisScreen,
  geheugen: GeheugenScreen,
  instellingen: SettingsScreen,
}

const SCREEN_IDS: ScreenId[] = [
  "chat",
  "agenda",
  "vergaderingen",
  "website",
  "concurrenten",
  "nieuws",
  "cv",
  "kennis",
  "geheugen",
  "instellingen",
]

export default function DashboardPage() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("chat")

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <AppSidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
      <main className="relative flex-1 overflow-hidden">
        {SCREEN_IDS.map((id) => {
          const Component = screens[id]
          const isActive = activeScreen === id
          return (
            <div
              key={id}
              className="absolute inset-0 overflow-hidden"
              style={{
                visibility: isActive ? "visible" : "hidden",
                pointerEvents: isActive ? "auto" : "none",
              }}
              aria-hidden={!isActive}
            >
              <Component isActive={isActive} />
            </div>
          )
        })}
      </main>
    </div>
  )
}
