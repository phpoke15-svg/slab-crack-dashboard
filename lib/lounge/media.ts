import "server-only"
import { createAdminClient } from "@/lib/supabase/server"

export const LOUNGE_MEDIA_BUCKET = "lounge-media"
export const MAX_LOUNGE_MEDIA = 4
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
])

const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"])

export type LoungeMediaKind = "image" | "video"

export type LoungeMediaUpload = {
  storagePath: string
  kind: LoungeMediaKind
  mimeType: string
  sortOrder: number
}

function extFor(file: File, kind: LoungeMediaKind): string {
  const fromName = file.name.split(".").pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  if (kind === "video") {
    if (file.type === "video/webm") return "webm"
    if (file.type === "video/quicktime") return "mov"
    return "mp4"
  }
  if (file.type === "image/png") return "png"
  if (file.type === "image/webp") return "webp"
  if (file.type === "image/gif") return "gif"
  if (file.type.includes("heic") || file.type.includes("heif")) return "heic"
  return "jpg"
}

export function classifyLoungeFile(file: File): {
  kind: LoungeMediaKind
  error?: string
} {
  const type = (file.type || "").toLowerCase()
  if (IMAGE_TYPES.has(type) || type.startsWith("image/")) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { kind: "image", error: "Images must be 8 MB or smaller." }
    }
    return { kind: "image" }
  }
  if (VIDEO_TYPES.has(type) || type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_BYTES) {
      return { kind: "video", error: "Videos must be 50 MB or smaller." }
    }
    return { kind: "video" }
  }
  return {
    kind: "image",
    error: "Only photos (JPEG/PNG/WebP/GIF/HEIC) and videos (MP4/WebM/MOV) are allowed.",
  }
}

export async function uploadLoungeMediaFiles(
  authorId: string,
  files: File[],
): Promise<LoungeMediaUpload[]> {
  if (files.length === 0) return []
  if (files.length > MAX_LOUNGE_MEDIA) {
    throw new Error(`Up to ${MAX_LOUNGE_MEDIA} photos/videos per post.`)
  }

  const admin = createAdminClient()
  const out: LoungeMediaUpload[] = []
  let videoCount = 0

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]!
    const { kind, error } = classifyLoungeFile(file)
    if (error) throw new Error(error)
    if (kind === "video") {
      videoCount += 1
      if (videoCount > 1) throw new Error("Only one video per post (you can add photos with it).")
    }

    const ext = extFor(file, kind)
    const path = `${authorId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await admin.storage.from(LOUNGE_MEDIA_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
    })
    if (upErr) throw new Error(upErr.message)

    out.push({
      storagePath: path,
      kind,
      mimeType: file.type || "",
      sortOrder: i,
    })
  }

  return out
}

export async function resolveLoungeMediaUrl(storagePath: string): Promise<string> {
  if (!storagePath) return ""
  if (storagePath.startsWith("http")) return storagePath
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(LOUNGE_MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
  return error || !data?.signedUrl ? "" : data.signedUrl
}

export async function deleteLoungeStoragePaths(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return
  const admin = createAdminClient()
  await admin.storage.from(LOUNGE_MEDIA_BUCKET).remove(unique)
}
