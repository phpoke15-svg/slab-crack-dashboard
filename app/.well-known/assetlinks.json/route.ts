import { NextResponse } from "next/server"
import { ANDROID_PACKAGE } from "@/lib/app-stores"

/** Android App Links — set ANDROID_APP_LINK_SHA256 (colon-separated) after Play signing cert is known. */
export function GET() {
  const raw = process.env.ANDROID_APP_LINK_SHA256?.trim()
  const fingerprints =
    raw ?
      raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : []

  const body =
    fingerprints.length > 0 ?
      [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: ANDROID_PACKAGE,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : []

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
