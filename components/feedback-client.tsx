"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowBigDown, ArrowBigUp, Loader2, MessageSquarePlus, Shield } from "lucide-react"
import { useOptionalEntitlements } from "@/components/billing/entitlements-provider"
import type { FeedbackMessage, RoadmapIdea } from "@/lib/feedback/types"
import { cn } from "@/lib/utils"

function formatWhen(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ""
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function FeedbackClient() {
  const entitlements = useOptionalEntitlements()
  const signedIn = Boolean(entitlements?.signedIn)
  const isSupreme = Boolean(entitlements?.supreme)
  const authLoading = Boolean(entitlements?.isLoading)

  const [feedbackBody, setFeedbackBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [ideas, setIdeas] = useState<RoadmapIdea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(true)
  const [ideasError, setIdeasError] = useState<string | null>(null)
  const [votingId, setVotingId] = useState<string | null>(null)

  const [inbox, setInbox] = useState<FeedbackMessage[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [inboxError, setInboxError] = useState<string | null>(null)

  const [ideaTitle, setIdeaTitle] = useState("")
  const [ideaDescription, setIdeaDescription] = useState("")
  const [creatingIdea, setCreatingIdea] = useState(false)
  const [createIdeaError, setCreateIdeaError] = useState<string | null>(null)

  const loadIdeas = useCallback(async () => {
    setIdeasLoading(true)
    setIdeasError(null)
    try {
      const res = await fetch("/api/feedback/roadmap", { credentials: "same-origin" })
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        ideas?: RoadmapIdea[]
        error?: string
      } | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not load potential tools")
      }
      setIdeas(json.ideas ?? [])
    } catch (error) {
      setIdeas([])
      setIdeasError(error instanceof Error ? error.message : "Could not load potential tools")
    } finally {
      setIdeasLoading(false)
    }
  }, [])

  const loadInbox = useCallback(async () => {
    if (!isSupreme) return
    setInboxLoading(true)
    setInboxError(null)
    try {
      const res = await fetch("/api/feedback", { credentials: "same-origin" })
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        messages?: FeedbackMessage[]
        error?: string
      } | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not load feedback inbox")
      }
      setInbox(json.messages ?? [])
    } catch (error) {
      setInbox([])
      setInboxError(error instanceof Error ? error.message : "Could not load feedback inbox")
    } finally {
      setInboxLoading(false)
    }
  }, [isSupreme])

  useEffect(() => {
    void loadIdeas()
  }, [loadIdeas])

  useEffect(() => {
    if (!authLoading && isSupreme) void loadInbox()
  }, [authLoading, isSupreme, loadInbox])

  const onSubmitFeedback = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!signedIn) return
    setSubmitting(true)
    setSubmitError(null)
    setSubmitMessage(null)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: feedbackBody }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not submit feedback")
      }
      setFeedbackBody("")
      setSubmitMessage("Thanks — your feedback was sent.")
      if (isSupreme) void loadInbox()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not submit feedback")
    } finally {
      setSubmitting(false)
    }
  }

  const onVote = async (ideaId: string, value: -1 | 1) => {
    if (!signedIn) return
    setVotingId(ideaId)
    setIdeasError(null)
    try {
      const res = await fetch("/api/feedback/roadmap/vote", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, value }),
      })
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        ideas?: RoadmapIdea[]
        error?: string
      } | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not save vote")
      }
      setIdeas(json.ideas ?? [])
    } catch (error) {
      setIdeasError(error instanceof Error ? error.message : "Could not save vote")
    } finally {
      setVotingId(null)
    }
  }

  const onCreateIdea = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isSupreme) return
    setCreatingIdea(true)
    setCreateIdeaError(null)
    try {
      const res = await fetch("/api/feedback/roadmap", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: ideaTitle, description: ideaDescription }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not add idea")
      }
      setIdeaTitle("")
      setIdeaDescription("")
      await loadIdeas()
    } catch (error) {
      setCreateIdeaError(error instanceof Error ? error.message : "Could not add idea")
    } finally {
      setCreatingIdea(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <MessageSquarePlus className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-foreground">Send feedback</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bugs, ideas, compliments — write anything. Supreme reads these privately.
            </p>
          </div>
        </div>

        {!authLoading && !signedIn ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/sign-in?next=/feedback" className="font-medium text-primary hover:underline">
              Sign in
            </Link>{" "}
            to send feedback.
          </p>
        ) : (
          <form onSubmit={onSubmitFeedback} className="mt-4 space-y-3">
            <textarea
              value={feedbackBody}
              onChange={(e) => setFeedbackBody(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="What’s working, what’s missing, what should we build next…"
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
              required
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{feedbackBody.length}/4000</span>
              <button
                type="submit"
                disabled={submitting || !feedbackBody.trim() || authLoading}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : "Send feedback"}
              </button>
            </div>
            {submitMessage ? <p className="text-sm text-primary">{submitMessage}</p> : null}
            {submitError ? <p className="text-sm text-amber-600">{submitError}</p> : null}
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">What should we build next?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upvote or downvote potential tools. Score is upvotes minus downvotes.
          </p>
        </div>

        {ideasLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading ideas…
          </div>
        ) : ideasError ? (
          <p className="text-sm text-amber-600">{ideasError}</p>
        ) : ideas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No potential tools listed yet. Supreme can add ideas below.
          </p>
        ) : (
          <ul className="space-y-3">
            {ideas.map((idea) => (
              <li
                key={idea.id}
                className="flex gap-3 rounded-xl border border-border/80 bg-background/60 p-3"
              >
                <div className="flex w-12 shrink-0 flex-col items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Upvote ${idea.title}`}
                    disabled={!signedIn || votingId === idea.id}
                    onClick={() => void onVote(idea.id, 1)}
                    className={cn(
                      "rounded-md p-0.5 text-muted-foreground transition-colors hover:text-primary disabled:opacity-40",
                      idea.myVote === 1 && "text-primary",
                    )}
                  >
                    <ArrowBigUp className="size-6" strokeWidth={idea.myVote === 1 ? 2.5 : 1.75} />
                  </button>
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      idea.score > 0 && "text-primary",
                      idea.score < 0 && "text-amber-600",
                    )}
                  >
                    {idea.score}
                  </span>
                  <button
                    type="button"
                    aria-label={`Downvote ${idea.title}`}
                    disabled={!signedIn || votingId === idea.id}
                    onClick={() => void onVote(idea.id, -1)}
                    className={cn(
                      "rounded-md p-0.5 text-muted-foreground transition-colors hover:text-amber-600 disabled:opacity-40",
                      idea.myVote === -1 && "text-amber-600",
                    )}
                  >
                    <ArrowBigDown
                      className="size-6"
                      strokeWidth={idea.myVote === -1 ? 2.5 : 1.75}
                    />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{idea.title}</h3>
                  {idea.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {idea.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {idea.upvotes} up · {idea.downvotes} down
                    {!signedIn ? (
                      <>
                        {" · "}
                        <Link
                          href="/sign-in?next=/feedback"
                          className="font-medium text-primary hover:underline"
                        >
                          Sign in to vote
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {isSupreme ? (
          <form
            onSubmit={onCreateIdea}
            className="mt-5 space-y-2 border-t border-border pt-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Supreme · add potential tool
            </p>
            <input
              value={ideaTitle}
              onChange={(e) => setIdeaTitle(e.target.value)}
              maxLength={120}
              placeholder="Tool name"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
              required
            />
            <textarea
              value={ideaDescription}
              onChange={(e) => setIdeaDescription(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Short pitch for voters (optional)"
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <button
              type="submit"
              disabled={creatingIdea || !ideaTitle.trim()}
              className="inline-flex h-9 items-center rounded-lg border border-primary/40 bg-primary/15 px-3 text-xs font-semibold text-primary disabled:opacity-50"
            >
              {creatingIdea ? <Loader2 className="size-3.5 animate-spin" /> : "Add to voting board"}
            </button>
            {createIdeaError ? <p className="text-sm text-amber-600">{createIdeaError}</p> : null}
          </form>
        ) : null}
      </section>

      {isSupreme ? (
        <section className="rounded-2xl border border-primary/25 bg-primary/[0.03] p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <Shield className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Supreme inbox</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Private feedback from collectors. Only Supreme can read this section.
              </p>
            </div>
          </div>

          {inboxLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading inbox…
            </div>
          ) : inboxError ? (
            <p className="text-sm text-amber-600">{inboxError}</p>
          ) : inbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback yet.</p>
          ) : (
            <ul className="space-y-3">
              {inbox.map((message) => (
                <li
                  key={message.id}
                  className="rounded-xl border border-border/80 bg-background/70 px-3 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {message.authorLabel}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatWhen(message.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {message.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
