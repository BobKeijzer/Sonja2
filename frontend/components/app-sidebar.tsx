"use client"

import React from "react"

import {
  MessageSquare,
  Calendar,
  FileText,
  Globe,
  Eye,
  Brain,
  User,
  Settings,
} from "lucide-react"
import Image from "next/image"
import { AfasLogo } from "@/components/afas-logo"
import type { ScreenId } from "@/lib/types"

const navItems: { id: ScreenId; label: string; icon: React.ElementType }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "agenda", label: "Agenda", icon: Calendar },
  { id: "vergaderingen", label: "Vergaderingen", icon: FileText },
  { id: "website", label: "Website Analyse", icon: Globe },
  { id: "concurrenten", label: "Concurrenten", icon: Eye },
  { id: "geheugen", label: "Geheugen", icon: Brain },
  { id: "cv", label: "Sonja's CV", icon: User },
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
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/20">
          <Image
            src="/sonja.png"
            alt="Sonja avatar"
            fill
            className="object-cover"
          />
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
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
