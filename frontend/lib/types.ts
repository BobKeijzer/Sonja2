export interface ThinkingStep {
  tool: string
  summary: string | null
  emoji?: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  steps?: ThinkingStep[]
  timestamp: Date
}

export interface SuggestionCard {
  id: string
  emoji: string
  title: string
  description: string
  prompt: string
}

export interface AgendaItem {
  id: string
  title: string
  prompt: string
  type: "once" | "recurring"
  schedule: string
  mail_to: string[]
  created_at?: string
  last_run_at?: string | null
}

export interface Competitor {
  id: string
  name: string
}

export interface KnowledgeFile {
  name: string
  content?: string
}

export type ScreenId =
  | "chat"
  | "agenda"
  | "vergaderingen"
  | "website"
  | "concurrenten"
  | "geheugen"
  | "cv"
  | "instellingen"
