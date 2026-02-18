export interface ThinkingStep {
  tool: string
  summary: string | null
  display_label?: string | null
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
  created_at?: string
  last_run_at?: string | null
  /** Volgende geplande uitvoering (ISO), alleen bij GET /agenda */
  next_run_at?: string | null
  /** Antwoord van Sonja bij laatste run */
  last_run_response?: string | null
  /** Denkstappen (tool-aanroepen) bij laatste run */
  last_run_steps?: ThinkingStep[] | null
}

export interface Competitor {
  id: string
  name: string
}

export interface KnowledgeFile {
  name: string
  content?: string
}

export interface NewsItem {
  title: string
  url: string
  summary: string
  source: string
  published_at: string
  image_url?: string | null
}

export type ScreenId =
  | "chat"
  | "agenda"
  | "vergaderingen"
  | "website"
  | "concurrenten"
  | "nieuws"
  | "cv"
  | "kennis"
  | "geheugen"
  | "instellingen"
