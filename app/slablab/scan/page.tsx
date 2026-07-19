import { redirect } from "next/navigation"
import { SLABIT_HREF } from "@/lib/slabs-labs-routes"

export default function SlabLabScanLegacyRedirect() {
  redirect(`${SLABIT_HREF}/scan`)
}
