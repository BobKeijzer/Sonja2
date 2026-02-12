import type {
  AgendaItem,
  Competitor,
  ThinkingStep,
} from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ─── Emoji mapping for thinking steps ──────────────────────────────────────

const TOOL_EMOJI: Record<string, string> = {
  "Search the internet with Serper": "🔎",
  "Read website content": "🌐",
  "read_knowledge_file": "📄",
  "rag_search": "🧠",
  "write_to_memory": "💾",
  "spy_competitor_research": "🕵️",
  "send_email": "📧",
  "add_agenda_item": "📅",
  "list_agenda_items": "📋",
  "update_agenda_item": "✏️",
  "delete_agenda_item": "🗑️",
}

function addEmojis(steps: ThinkingStep[]): ThinkingStep[] {
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
