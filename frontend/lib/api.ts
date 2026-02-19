import type {
  AgendaItem,
  Competitor,
  ThinkingStep,
} from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ─── Emoji mapping for thinking steps ──────────────────────────────────────

const TOOL_EMOJI: Record<string, string> = {
  "web_search": "🔎",
  "scrape_website": "🌐",
  "read_file": "📄",
  "read_knowledge_file": "📄",
  "rag_search": "🧠",
  "write_to_memory": "💾",
  "spy_competitor_research": "🕵️",
  "send_email": "📧",
  "add_agenda_item": "📅",
  "list_agenda_items": "📋",
  "update_agenda_item": "✏️",
  "delete_agenda_item": "🗑️",
  get_call_transcripts: "📞",
}

export function addEmojis(steps: ThinkingStep[]): ThinkingStep[] {
  return steps.map((s) => ({
    ...s,
    emoji: TOOL_EMOJI[s.tool] || "⚙️",
  }))
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  context: string = ""
): Promise<{ response: string; steps: ThinkingStep[] }> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  })
  if (!res.ok) throw new Error("Chat request failed")
  const data = await res.json()
  return { response: data.response, steps: addEmojis(data.steps || []) }
}

/** Chat met SSE-stream: onStep wordt per stap aangeroepen, daarna wordt { response, steps } geretourneerd. */
export async function sendChatMessageStream(
  message: string,
  context: string,
  onStep: (step: ThinkingStep) => void
): Promise<{ response: string; steps: ThinkingStep[] }> {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  })
  if (!res.ok) throw new Error("Chat stream failed")
  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")
  const decoder = new TextDecoder()
  let buffer = ""
  let currentEvent = ""
  let currentData = ""
  const steps: ThinkingStep[] = []
  let response = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim()
      } else if (line.startsWith("data:")) {
        currentData = line.slice(5).trim()
      } else if (line === "" && currentData) {
        try {
          const data = JSON.parse(currentData)
          if (currentEvent === "step") {
            const step: ThinkingStep = {
              tool: data.tool ?? "",
              summary: data.summary ?? null,
              display_label: data.display_label ?? null,
            }
            const withEmoji = addEmojis([step])[0]
            steps.push(withEmoji)
            onStep(withEmoji)
          } else if (currentEvent === "done" && data.response !== undefined) {
            response = data.response
          }
        } catch {
          // ignore parse errors
        }
        currentEvent = ""
        currentData = ""
      }
    }
  }
  if (buffer.trim()) {
    const lines = buffer.split("\n")
    for (const line of lines) {
      if (line.startsWith("event:")) currentEvent = line.slice(6).trim()
      else if (line.startsWith("data:")) currentData = line.slice(5).trim()
      else if (line === "" && currentData) {
        try {
          const data = JSON.parse(currentData)
          if (currentEvent === "done" && data.response !== undefined) response = data.response
        } catch { /* ignore */ }
        currentEvent = ""
        currentData = ""
      }
    }
  }
  return { response, steps }
}

/** Hergebruikbare SSE-parser: leest event step + done uit een stream, roept onStep aan, retourneert response + steps. */
async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onStep: (step: ThinkingStep) => void
): Promise<{ response: string }> {
  const decoder = new TextDecoder()
  let buffer = ""
  let currentEvent = ""
  let currentData = ""
  let response = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (line.startsWith("event:")) currentEvent = line.slice(6).trim()
      else if (line.startsWith("data:")) currentData = line.slice(5).trim()
      else if (line === "" && currentData) {
        try {
          const data = JSON.parse(currentData)
          if (currentEvent === "step") {
            const step: ThinkingStep = {
              tool: data.tool ?? "",
              summary: data.summary ?? null,
              display_label: data.display_label ?? null,
            }
            const withEmoji = addEmojis([step])[0]
            onStep(withEmoji)
          } else if (currentEvent === "done" && data.response !== undefined) {
            response = data.response
          }
        } catch { /* ignore */ }
        currentEvent = ""
        currentData = ""
      }
    }
  }
  if (buffer.trim()) {
    const lines = buffer.split("\n")
    for (const line of lines) {
      if (line.startsWith("event:")) currentEvent = line.slice(6).trim()
      else if (line.startsWith("data:")) currentData = line.slice(5).trim()
      else if (line === "" && currentData) {
        try {
          const data = JSON.parse(currentData)
          if (currentEvent === "done" && data.response !== undefined) response = data.response
        } catch { /* ignore */ }
      }
    }
  }
  return { response }
}

// ─── Meetings ────────────────────────────────────────────────────────────────

export async function extractMeeting(
  transcript: string,
  customPrompt?: string
): Promise<{ response: string; steps: ThinkingStep[] }> {
  const res = await fetch(`${API_BASE}/meetings/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript,
      ...(customPrompt?.trim() ? { custom_prompt: customPrompt.trim() } : {}),
    }),
  })
  if (!res.ok) throw new Error("Meeting extraction failed")
  const data = await res.json()
  return { response: data.response, steps: addEmojis(data.steps || []) }
}

/** Vergadering extract met SSE: onStep per stap, daarna { response, steps }. */
export async function extractMeetingStream(
  transcript: string,
  customPrompt: string | undefined,
  onStep: (step: ThinkingStep) => void
): Promise<{ response: string; steps: ThinkingStep[] }> {
  const res = await fetch(`${API_BASE}/meetings/extract/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript,
      ...(customPrompt?.trim() ? { custom_prompt: customPrompt.trim() } : {}),
    }),
  })
  if (!res.ok) throw new Error("Meeting extraction stream failed")
  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")
  const steps: ThinkingStep[] = []
  const wrapped = (s: ThinkingStep) => {
    steps.push(s)
    onStep(s)
  }
  const { response } = await parseSSEStream(reader, wrapped)
  return { response, steps }
}

// ─── Website Analysis ────────────────────────────────────────────────────────

export async function analyzeWebsite(
  url: string,
  customPrompt?: string
): Promise<{ response: string; steps: ThinkingStep[] }> {
  const res = await fetch(`${API_BASE}/analyze/website`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      ...(customPrompt?.trim() ? { custom_prompt: customPrompt.trim() } : {}),
    }),
  })
  if (!res.ok) throw new Error("Website analysis failed")
  const data = await res.json()
  return { response: data.response, steps: addEmojis(data.steps || []) }
}

/** Website-analyse met SSE: onStep per stap, daarna { response, steps }. */
export async function analyzeWebsiteStream(
  url: string,
  customPrompt: string | undefined,
  onStep: (step: ThinkingStep) => void
): Promise<{ response: string; steps: ThinkingStep[] }> {
  const res = await fetch(`${API_BASE}/analyze/website/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      ...(customPrompt?.trim() ? { custom_prompt: customPrompt.trim() } : {}),
    }),
  })
  if (!res.ok) throw new Error("Website analysis stream failed")
  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")
  const steps: ThinkingStep[] = []
  const wrapped = (s: ThinkingStep) => {
    steps.push(s)
    onStep(s)
  }
  const { response } = await parseSSEStream(reader, wrapped)
  return { response, steps }
}

// ─── Competitors ─────────────────────────────────────────────────────────────

export async function getCompetitors(): Promise<Competitor[]> {
  const res = await fetch(`${API_BASE}/competitors`)
  if (!res.ok) throw new Error("Failed to fetch competitors")
  const data = await res.json()
  return data.competitors ?? []
}

export async function addCompetitor(name: string): Promise<Competitor> {
  const res = await fetch(`${API_BASE}/competitors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error("Failed to add competitor")
  return res.json()
}

export async function updateCompetitor(
  id: string,
  data: Partial<Competitor>
): Promise<Competitor> {
  const res = await fetch(`${API_BASE}/competitors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update competitor")
  return res.json()
}

export async function deleteCompetitor(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/competitors/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete competitor")
}

export async function analyzeCompetitors(
  names: string[],
  customPrompt?: string
): Promise<{ response: string; steps: ThinkingStep[] }> {
  const res = await fetch(`${API_BASE}/analyze/competitors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      competitor_names: names,
      custom_prompt: customPrompt || null,
    }),
  })
  if (!res.ok) throw new Error("Competitor analysis failed")
  const data = await res.json()
  return { response: data.response, steps: addEmojis(data.steps || []) }
}

/** Concurrenten-analyse met SSE: onStep per stap, daarna { response, steps }. */
export async function analyzeCompetitorsStream(
  names: string[],
  customPrompt: string | undefined,
  onStep: (step: ThinkingStep) => void
): Promise<{ response: string; steps: ThinkingStep[] }> {
  const res = await fetch(`${API_BASE}/analyze/competitors/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      competitor_names: names,
      custom_prompt: customPrompt || null,
    }),
  })
  if (!res.ok) throw new Error("Competitor analysis stream failed")
  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")
  const steps: ThinkingStep[] = []
  const wrapped = (s: ThinkingStep) => {
    steps.push(s)
    onStep(s)
  }
  const { response } = await parseSSEStream(reader, wrapped)
  return { response, steps }
}

// ─── Agenda ──────────────────────────────────────────────────────────────────

export async function getAgendaItems(): Promise<AgendaItem[]> {
  const res = await fetch(`${API_BASE}/agenda`)
  if (!res.ok) throw new Error("Failed to fetch agenda items")
  return res.json()
}

export async function createAgendaItem(
  item: Omit<AgendaItem, "id" | "created_at" | "last_run_at">
): Promise<AgendaItem> {
  const res = await fetch(`${API_BASE}/agenda`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  })
  if (!res.ok) throw new Error("Failed to create agenda item")
  return res.json()
}

export async function updateAgendaItem(
  id: string,
  data: Partial<AgendaItem>
): Promise<AgendaItem> {
  const res = await fetch(`${API_BASE}/agenda/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update agenda item")
  return res.json()
}

export async function deleteAgendaItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agenda/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete agenda item")
}

// ─── Knowledge / Files ──────────────────────────────────────────────────────

export async function getKnowledgeFiles(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/knowledge`)
  if (!res.ok) throw new Error("Failed to fetch knowledge files")
  const data = await res.json()
  return data.files ?? []
}

export async function getKnowledgeContent(filename: string): Promise<string> {
  const res = await fetch(`${API_BASE}/knowledge/${encodeURIComponent(filename)}`)
  if (!res.ok) throw new Error("Failed to fetch file content")
  const data = await res.json()
  return data.content ?? ""
}

export async function uploadKnowledgeFile(file: File): Promise<void> {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/knowledge/upload`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to upload file")
}

export async function createKnowledgeFile(
  filename: string,
  content: string
): Promise<void> {
  const name = filename.trim().endsWith(".md") || filename.trim().endsWith(".txt")
    ? filename.trim()
    : `${filename.trim()}.md`
  const res = await fetch(`${API_BASE}/knowledge/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: name, content }),
  })
  if (!res.ok) throw new Error("Failed to create document")
}

export async function updateKnowledgeFile(
  filename: string,
  content: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/knowledge/${encodeURIComponent(filename)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error("Failed to update file")
}

export async function deleteKnowledgeFile(filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/knowledge/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete file")
}

/** Vernieuw de zoekindex (RAG) over alle kennis en herinneringen. Aan te raden na handmatige wijzigingen of als zoeken niet klopt. */
export async function refreshKnowledgeIndex(): Promise<void> {
  const res = await fetch(`${API_BASE}/knowledge/refresh`, { method: "POST" })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const detail = data.detail ?? "Vernieuwen mislukt."
    throw new Error(typeof detail === "string" ? detail : "Vernieuwen mislukt.")
  }
}

// ─── Geheugen (memory/) – alleen lijst, open, bewerken, verwijderen ─────────────────

export async function getMemoryFiles(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/memory`)
  if (!res.ok) throw new Error("Failed to fetch memory files")
  const data = await res.json()
  return data.files ?? []
}

export async function getMemoryContent(filename: string): Promise<string> {
  const res = await fetch(`${API_BASE}/memory/${encodeURIComponent(filename)}`)
  if (!res.ok) throw new Error("Failed to fetch memory content")
  const data = await res.json()
  return data.content ?? ""
}

export async function updateMemoryFile(
  filename: string,
  content: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/memory/${encodeURIComponent(filename)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error("Failed to update memory file")
}

export async function deleteMemoryFile(filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/memory/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete memory file")
}

// ─── Nieuws (RSS + generate) ─────────────────────────────────────────────────────

export interface NewsPrompts {
  inhaker: string
  linkedin: string
  afas_betekenis: string
}

export type NewsGenerateTask =
  | "inhaker"
  | "linkedin"
  | "afas_betekenis"
  | "custom"

export async function getNewsItems(): Promise<
  { items: import("./types").NewsItem[]; last_updated: string | null } 
> {
  const res = await fetch(`${API_BASE}/news`)
  if (!res.ok) throw new Error("Failed to fetch news")
  const data = await res.json()
  return {
    items: data.items ?? [],
    last_updated: data.last_updated ?? null,
  }
}

export async function getNewsFeeds(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/news/feeds`)
  if (!res.ok) throw new Error("Failed to fetch news feeds")
  const data = await res.json()
  return data.urls ?? []
}

export async function updateNewsFeeds(urls: string[]): Promise<string[]> {
  const res = await fetch(`${API_BASE}/news/feeds`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  })
  if (!res.ok) throw new Error("Failed to update news feeds")
  const data = await res.json()
  return data.urls ?? []
}

export async function getNewsPrompts(): Promise<NewsPrompts> {
  const res = await fetch(`${API_BASE}/news/prompts`)
  if (!res.ok) throw new Error("Failed to fetch news prompts")
  return res.json()
}

export async function updateNewsPrompts(
  prompts: Partial<NewsPrompts>
): Promise<NewsPrompts> {
  const res = await fetch(`${API_BASE}/news/prompts`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prompts),
  })
  if (!res.ok) throw new Error("Failed to update news prompts")
  return res.json()
}

export async function generateNewsContent(
  newsItem: import("./types").NewsItem,
  task: NewsGenerateTask,
  customPrompt?: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/news/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      news_item: newsItem,
      task,
      custom_prompt: task === "custom" ? (customPrompt ?? "") : undefined,
    }),
  })
  if (!res.ok) throw new Error("Failed to generate news content")
  const data = await res.json()
  return data.content ?? ""
}

/** Nieuws genereren met SSE: onStep per stap, daarna { content }. */
export async function generateNewsContentStream(
  newsItem: import("./types").NewsItem,
  task: NewsGenerateTask,
  customPrompt: string | undefined,
  onStep: (step: ThinkingStep) => void
): Promise<{ content: string; steps: ThinkingStep[] }> {
  const res = await fetch(`${API_BASE}/news/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      news_item: newsItem,
      task,
      custom_prompt: task === "custom" ? (customPrompt ?? "") : undefined,
    }),
  })
  if (!res.ok) throw new Error("News generate stream failed")
  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")
  const steps: ThinkingStep[] = []
  const wrapped = (s: ThinkingStep) => {
    steps.push(s)
    onStep(s)
  }
  const { response } = await parseSSEStream(reader, wrapped)
  return { content: response ?? "", steps }
}
