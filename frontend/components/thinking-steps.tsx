"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Search } from "lucide-react"
import type { ThinkingStep } from "@/lib/types"

interface ThinkingStepsProps {
  steps: ThinkingStep[]
  defaultOpen?: boolean
}

export function ThinkingSteps({
  steps,
  defaultOpen = true,
}: ThinkingStepsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!steps.length) return null

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="h-3 w-3" />
        <span>Sonja&apos;s stappen</span>
        {isOpen ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
          {steps.length}
        </span>
      </button>
      {isOpen && (
        <div className="ml-2 mt-1 flex flex-col gap-1 border-l-2 border-muted pl-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              <span className="shrink-0 pt-px">{step.emoji}</span>
              <span className="font-medium text-foreground/80">
                {step.display_label ??
                  (step.summary ? `${step.tool} – ${step.summary}` : step.tool)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
