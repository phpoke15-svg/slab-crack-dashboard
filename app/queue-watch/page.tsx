import { redirect } from "next/navigation"

/** Legacy Queue Watch URL — keep for bookmarks and old links. */
export default function QueueWatchRedirectPage() {
  redirect("/pokewatch")
}
