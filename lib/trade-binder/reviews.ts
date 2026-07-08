import type { SupabaseClient } from "@supabase/supabase-js"
import type { Review } from "@/lib/trade-binder/users"

type ReviewRow = {
  id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string
  created_at: string
}

function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    authorId: row.reviewer_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at.slice(0, 10),
  }
}

export async function listReviewsForUser(
  supabase: SupabaseClient,
  revieweeId: string,
): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("reviewee_id", revieweeId)
    .order("created_at", { ascending: false })

  if (error || !data) return []
  return (data as ReviewRow[]).map(mapReview)
}

export async function upsertReview(
  supabase: SupabaseClient,
  reviewerId: string,
  revieweeId: string,
  rating: number,
  comment: string,
  tradeId?: string,
): Promise<{ review: Review | null; error: string | null }> {
  const { data, error } = await supabase
    .from("reviews")
    .upsert(
      {
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim(),
        trade_id: tradeId ?? null,
      },
      { onConflict: "reviewer_id,reviewee_id" },
    )
    .select("*")
    .single()

  if (error || !data) return { review: null, error: error?.message ?? "Could not save review" }
  return { review: mapReview(data as ReviewRow), error: null }
}
