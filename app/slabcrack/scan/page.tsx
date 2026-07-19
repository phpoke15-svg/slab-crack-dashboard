import { redirect } from "next/navigation"
import { SLABCRACK_HREF } from "@/lib/slabs-labs-routes"

export default function SlabCrackScanLegacyRedirect() {
  redirect(`${SLABCRACK_HREF}/scan`)
}
