import { redirect } from "next/navigation"
import { SLABIT_HREF } from "@/lib/slabs-labs-routes"

export default function Psa10ScannerRedirect() {
  redirect(SLABIT_HREF)
}
