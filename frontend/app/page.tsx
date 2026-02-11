"use client"

import React from "react"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChatScreen } from "@/components/screens/chat-screen"
import { AgendaScreen } from "@/components/screens/agenda-screen"
import { MeetingsScreen } from "@/components/screens/meetings-screen"
import { WebsiteScreen } from "@/components/screens/website-screen"
import { CompetitorsScreen } from "@/components/screens/competitors-screen"
import { MemoryScreen } from "@/components/screens/memory-screen"
import { CvScreen } from "@/components/screens/cv-screen"
import { SettingsScreen } from "@/components/screens/settings-screen"
import type { ScreenId } from "@/lib/types"

const screens: Record<ScreenId, React.ComponentType> = {
  chat: ChatScreen,
  agenda: AgendaScreen,
  vergaderingen: MeetingsScreen,
  website: WebsiteScreen,
  concurrenten: CompetitorsScreen,
  geheugen: MemoryScreen,
  cv: CvScreen,
  instellingen: SettingsScreen,
}

export default function DashboardPage() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("chat")
  const ActiveComponent = screens[activeScreen]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <AppSidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
      <main className="flex-1 overflow-hidden">
        <ActiveComponent />
      </main>
    </div>
  )
}
