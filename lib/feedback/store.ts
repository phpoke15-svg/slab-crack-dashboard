import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { FeedbackMessage, RoadmapIdea } from "@/lib/feedback/types"

function missingTableMessage(error: { message?: string } | null): string | null {
  const message = error?.message ?? ""
  if (/relation .* does not exist|could not find the table/i.test(message)) {
    return "Feedback tables are not set up yet. Run supabase/feedback.sql in the Supabase SQL editor."
  }
  return null
}

function displayName(profile: {
  display_name?: string | null
  handle?: string | null
} | null): string {
  const name = profile?.display_name?.trim() || profile?.handle?.trim()
  return name || "Collector"
}

export async function submitFeedback(opts: {
  authorId: string
  body: string
}): Promise<{ id: string }> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")
  const body = opts.body.trim()
  if (body.length < 1 || body.length > 4000) {
    throw new Error("Feedback must be between 1 and 4000 characters.")
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("feedback_messages")
    .insert({ author_id: opts.authorId, body })
    .select("id")
    .single()

  const missing = missingTableMessage(error)
  if (missing) throw new Error(missing)
  if (error) throw new Error(error.message)
  return { id: data.id as string }
}

export async function listFeedbackMessages(limit = 100): Promise<FeedbackMessage[]> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("feedback_messages")
    .select("id, body, created_at, author_id")
    .order("created_at", { ascending: false })
    .limit(limit)

  const missing = missingTableMessage(error)
  if (missing) throw new Error(missing)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{
    id: string
    body: string
    created_at: string
    author_id: string | null
  }>
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id).filter(Boolean))) as string[]

  const labelById = new Map<string, string>()
  if (authorIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, handle")
      .in("id", authorIds)
    for (const profile of profiles ?? []) {
      labelById.set(
        profile.id as string,
        displayName({
          display_name: profile.display_name as string | null,
          handle: profile.handle as string | null,
        }),
      )
    }
  }

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorId: row.author_id,
    authorLabel: row.author_id ? (labelById.get(row.author_id) ?? "Collector") : "Collector",
  }))
}

export async function listRoadmapIdeas(opts?: {
  userId?: string | null
}): Promise<RoadmapIdea[]> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")
  const admin = createAdminClient()

  const { data: ideas, error } = await admin
    .from("roadmap_ideas")
    .select("id, title, description, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })

  const missing = missingTableMessage(error)
  if (missing) throw new Error(missing)
  if (error) throw new Error(error.message)

  const ideaRows = (ideas ?? []) as Array<{
    id: string
    title: string
    description: string
    created_at: string
  }>
  if (!ideaRows.length) return []

  const ideaIds = ideaRows.map((idea) => idea.id)
  const { data: votes, error: voteError } = await admin
    .from("roadmap_votes")
    .select("idea_id, user_id, value")
    .in("idea_id", ideaIds)

  if (voteError) throw new Error(voteError.message)

  const upByIdea = new Map<string, number>()
  const downByIdea = new Map<string, number>()
  const myVoteByIdea = new Map<string, -1 | 1>()

  for (const vote of votes ?? []) {
    const ideaId = vote.idea_id as string
    const value = Number(vote.value) as -1 | 1
    if (value === 1) upByIdea.set(ideaId, (upByIdea.get(ideaId) ?? 0) + 1)
    if (value === -1) downByIdea.set(ideaId, (downByIdea.get(ideaId) ?? 0) + 1)
    if (opts?.userId && vote.user_id === opts.userId) {
      myVoteByIdea.set(ideaId, value)
    }
  }

  const ranked = ideaRows.map((idea) => {
    const upvotes = upByIdea.get(idea.id) ?? 0
    const downvotes = downByIdea.get(idea.id) ?? 0
    return {
      id: idea.id,
      title: idea.title,
      description: idea.description,
      createdAt: idea.created_at,
      upvotes,
      downvotes,
      score: upvotes - downvotes,
      myVote: (myVoteByIdea.get(idea.id) ?? 0) as -1 | 0 | 1,
    }
  })

  ranked.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
  return ranked
}

export async function createRoadmapIdea(opts: {
  createdBy: string
  title: string
  description?: string
}): Promise<{ id: string }> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")
  const title = opts.title.trim()
  const description = (opts.description ?? "").trim()
  if (title.length < 1 || title.length > 120) {
    throw new Error("Title must be between 1 and 120 characters.")
  }
  if (description.length > 1000) {
    throw new Error("Description must be 1000 characters or fewer.")
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("roadmap_ideas")
    .insert({
      title,
      description,
      created_by: opts.createdBy,
      active: true,
    })
    .select("id")
    .single()

  const missing = missingTableMessage(error)
  if (missing) throw new Error(missing)
  if (error) throw new Error(error.message)
  return { id: data.id as string }
}

export async function setRoadmapVote(opts: {
  userId: string
  ideaId: string
  value: -1 | 1
}): Promise<{ myVote: -1 | 0 | 1 }> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")
  const admin = createAdminClient()

  const { data: existing, error: existingError } = await admin
    .from("roadmap_votes")
    .select("value")
    .eq("idea_id", opts.ideaId)
    .eq("user_id", opts.userId)
    .maybeSingle()

  const missing = missingTableMessage(existingError)
  if (missing) throw new Error(missing)
  if (existingError) throw new Error(existingError.message)

  const current = existing ? (Number(existing.value) as -1 | 1) : 0

  // Same vote again → clear (toggle off).
  if (current === opts.value) {
    const { error } = await admin
      .from("roadmap_votes")
      .delete()
      .eq("idea_id", opts.ideaId)
      .eq("user_id", opts.userId)
    if (error) throw new Error(error.message)
    return { myVote: 0 }
  }

  const { error } = await admin.from("roadmap_votes").upsert(
    {
      idea_id: opts.ideaId,
      user_id: opts.userId,
      value: opts.value,
    },
    { onConflict: "idea_id,user_id" },
  )
  if (error) throw new Error(error.message)
  return { myVote: opts.value }
}
