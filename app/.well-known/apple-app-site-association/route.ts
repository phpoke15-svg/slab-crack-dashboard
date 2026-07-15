import { NextResponse } from "next/server"
import { IOS_BUNDLE_ID } from "@/lib/app-stores"

/** Universal Links — set APPLE_TEAM_ID in Vercel when Apple Developer team id is known. */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim()
  const details =
    teamId ?
      [
        {
          appID: `${teamId}.${IOS_BUNDLE_ID}`,
          paths: ["*"],
        },
      ]
    : []

  const body = {
    applinks: {
      apps: [],
      details,
    },
    webcredentials: teamId ? { apps: [`${teamId}.${IOS_BUNDLE_ID}`] } : { apps: [] },
  }

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
