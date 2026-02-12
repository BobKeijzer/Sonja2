"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Loader2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ThinkingSteps } from "@/components/thinking-steps"
import { MarkdownContent } from "@/components/markdown-content"
import type { ChatMessage } from "@/lib/types"
import { suggestionCards } from "@/lib/mock-data"
import { sendChatMessage } from "@/lib/api"

function makeWelcome(): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "Hoi! Ik ben Sonja, jouw digitale marketeer. Waarmee kan ik je helpen?",
    timestamp: new Date(),
  }
}

/** Format eerdere berichten voor Sonja-context (max laatste 20 berichten). */
function formatChatHistoryForContext(messages: ChatMessage[]): string {
  const maxMessages = 20
  const toUse = messages.slice(-maxMessages)
  return toUse
    .map((m) => {
      const label = m.role === "user" ? "Gebruiker" : "Sonja"
      return `${label}: ${m.content.trim()}`
    })
    .join("\n\n")
}

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [makeWelcome()])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Check settings for showSuggestions
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sonja-settings")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.showSuggestions === false) setShowSuggestions(false)
      }
    } catch { /* ignore */ }
  }, [])

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    setShowSuggestions(false)

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    }
    // Remove the static welcome message on first user send
    setMessages((prev) => [...prev.filter((m) => m.id !== "welcome"), userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const context = formatChatHistoryForContext(messages)
      const data = await sendChatMessage(messageText, context)
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        steps: data.steps,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, er ging iets mis bij het verbinden met de backend. Probeer het opnieuw.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {/* Suggestion cards - shown ABOVE the welcome message */}
          {showSuggestions && (
            <div className="grid grid-cols-3 gap-3">
              {suggestionCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleSend(card.prompt)}
                  className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <span className="text-lg leading-none">{card.emoji}</span>
                  <span className="text-sm font-medium text-foreground">
                    {card.title}
                  </span>
                  <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {card.description}
                  </span>
                </button>
              ))}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="relative mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full">
                  <Image
                    src="/sonja.png"
                    alt="Sonja"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div
                className={`max-w-[80%] ${msg.role === "user" ? "ml-auto" : ""}`}
              >
                {msg.role === "assistant" && msg.steps && msg.steps.length > 0 && (
                  <ThinkingSteps steps={msg.steps} />
                )}
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground [&_.markdown-content]:text-primary-foreground [&_.markdown-content_a]:text-primary-foreground/90"
                      : "bg-card text-card-foreground shadow-sm ring-1 ring-border"
                  }`}
                >
                  <MarkdownContent content={msg.content} />
                </div>
                <p className="mt-1 px-1 text-[10px] text-muted-foreground" suppressHydrationWarning>
                  {msg.timestamp.toLocaleTimeString("nl-NL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="relative mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full">
                <Image
                  src="/sonja.png"
                  alt="Sonja"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-border">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Sonja denkt na...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Stel een vraag aan Sonja..."
                rows={1}
                className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Verstuur bericht</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
