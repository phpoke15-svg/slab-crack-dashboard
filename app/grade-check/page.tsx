import { redirect } from "next/navigation"

/** Grade Check is paused — redirect bookmarks to the hub. */
export default function GradeCheckPage() {
  redirect("/")
}
