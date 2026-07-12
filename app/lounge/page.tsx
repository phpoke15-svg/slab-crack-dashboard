import { redirect } from "next/navigation"

/** Legacy path — CardLounge lives at /card-lounge. */
export default function LoungeRedirectPage() {
  redirect("/card-lounge")
}
