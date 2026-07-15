export type FeedbackMessage = {
  id: string
  body: string
  createdAt: string
  authorId: string | null
  authorLabel: string
}

export type RoadmapIdea = {
  id: string
  title: string
  description: string
  createdAt: string
  upvotes: number
  downvotes: number
  score: number
  myVote: -1 | 0 | 1
}
