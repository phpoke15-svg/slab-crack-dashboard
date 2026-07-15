export type NotificationType =
  | "friend_request"
  | "post_like"
  | "post_comment"
  | "price_alert"

export type UserNotification = {
  id: string
  userId: string
  type: NotificationType
  actorId: string | null
  entityType: string | null
  entityId: string | null
  title: string
  body: string
  url: string
  readAt: string | null
  createdAt: string
  actorName?: string | null
  actorHandle?: string | null
}
