"use client"

import React from "react"

import {
  MessageSquare,
  Calendar,
  FileText,
  Globe,
  Eye,
  Newspaper,
  User,
  Brain,
  Settings,
} from "lucide-react"
import { AfasLogo } from "@/components/afas-logo"
import { SonjaAvatar } from "@/components/sonja-avatar"
import type { ScreenId } from "@/lib/types"

const topNavItems: { id: ScreenId; label: string; icon: React.ElementType }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "agenda", label: "Agenda", icon: Calendar },
  { id: "vergaderingen", label: "Vergaderingen", icon: FileText },
  { id: "website", label: "Website", icon: Globe },
  { id: "concurrenten", label: "Concurrenten", icon: Eye },
  { id: "nieuws", label: "Nieuws", icon: Newspaper },
]

const bottomNavItems: { id: ScreenId; label: string; icon: React.ElementType }[] = [
  { id: "cv", label: "Sonja's CV", icon: User },
  { id: "kennis", label: "Kennis", icon: FileText },
  { id: "geheugen", label: "Geheugen", icon: Brain },
  { id: "instellingen", label: "Instellingen", icon: Settings },
]

interface AppSidebarProps {
  activeScreen: ScreenId
  onNavigate: (screen: ScreenId) => void
}

export function AppSidebar({ activeScreen, onNavigate }: AppSidebarProps) {
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Profile header */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <div className="ring-2 ring-primary/20 rounded-full">
          <SonjaAvatar mood="blij" size="md" alt="Sonja avatar" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            Sonja
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Digitale Marketeer
          </p>
        </div>
      </div>

      {/* Navigation: top + bottom block */}
      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {topNavItems.map((item) => {
            const isActive = activeScreen === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <ul className="mt-auto flex flex-col gap-0.5 pt-3">
          {bottomNavItems.map((item) => {
            const isActive = activeScreen === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer with AFAS logo */}
      <div className="flex items-center justify-center border-t border-sidebar-border px-5 py-4">
        <AfasLogo className="hidden h-9 w-auto dark:block" variant="white" />
        <AfasLogo className="block h-9 w-auto dark:hidden" variant="color" />
      </div>
    </aside>
  )
}
