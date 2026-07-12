"use client"

import { useState } from "react"
import { Loader2, Save } from "lucide-react"
import type { User } from "@/lib/trade-binder/users"
import type { BinderVisibility } from "@/lib/trade-binder/profile"
import { PlanBadge } from "@/components/plan-badge"
import { UserAvatar } from "./user-avatar"

export function ProfileEditor({
  profile,
  onSaved,
}: {
  profile: User
  onSaved: (profile: User) => void
}) {
  const [displayName, setDisplayName] = useState(profile.name)
  const [handle, setHandle] = useState(profile.handle.replace(/^@/, ""))
  const [bio, setBio] = useState(profile.bio)
  const [location, setLocation] = useState(profile.location)
  const [visibility, setVisibility] = useState<BinderVisibility>(
    profile.binderVisibility ?? "public",
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          handle,
          bio,
          location,
          binderVisibility: visibility,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not save profile")
        return
      }
      onSaved(data.profile)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <UserAvatar user={profile} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-foreground">Your profile</p>
            <PlanBadge plan={profile.plan ?? "free"} />
          </div>
          <p className="text-[11px] text-muted-foreground">Visible to other collectors on PokeMatch</p>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Display name</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="h-10 w-full rounded-xl border border-border bg-secondary/60 px-3 text-sm outline-none focus:border-primary/50"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Handle</span>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            className="h-10 flex-1 rounded-xl border border-border bg-secondary/60 px-3 text-sm outline-none focus:border-primary/50"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Location</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, State"
          className="h-10 w-full rounded-xl border border-border bg-secondary/60 px-3 text-sm outline-none focus:border-primary/50"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-secondary/60 p-3 text-sm outline-none focus:border-primary/50"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Binder visibility</span>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as BinderVisibility)}
          className="h-10 w-full rounded-xl border border-border bg-secondary/60 px-3 text-sm outline-none focus:border-primary/50"
        >
          <option value="public">Public — anyone can see your lists</option>
          <option value="friends">Friends only</option>
          <option value="private">Private — only you</option>
        </select>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-trade">Profile saved.</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save profile
      </button>
    </div>
  )
}
