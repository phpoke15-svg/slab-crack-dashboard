type PostgrestLikeError = {
  message?: string
  code?: string
  hint?: string
}

export function binderErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message

  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as PostgrestLikeError).message ?? "")
    const code = (error as PostgrestLikeError).code

    if (code === "42P01" || message.includes("user_binders")) {
      return "Perfect Match storage is not set up. Run supabase/user_binders.sql in your Supabase SQL editor, then try again."
    }

    if (message) return message
  }

  return fallback
}
