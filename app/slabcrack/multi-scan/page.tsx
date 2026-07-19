import { redirect } from "next/navigation"
import { SLABCRACK_HREF } from "@/lib/slabs-labs-routes"

export default function SlabCrackMultiScanLegacyRedirect() {
  redirect(`${SLABCRACK_HREF}/multi-scan`)
}
