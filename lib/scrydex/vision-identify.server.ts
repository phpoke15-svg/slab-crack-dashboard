import "server-only"

import { File } from "node:buffer"
import sharp from "sharp"
import {
  SCRYDEX_BASE_URL,
  SCRYDEX_CREDIT_COST,
  SCRYDEX_GAME_PATH,
} from "@/lib/scrydex/constants"
import { CreditLedger } from "@/lib/scrydex/credit-ledger"
import { InvalidVisionImageError, ScrydexApiError } from "@/lib/scrydex/errors"
import { stripVisionImageBase64 } from "@/lib/scrydex/vision-image"
import type { ScrydexVisionResponse, TcgGame } from "@/lib/scrydex/types"

async function normalizeVisionImageBytes(imageBase64: string): Promise<Buffer> {
  const payload = stripVisionImageBase64(imageBase64)
  if (!payload) throw new InvalidVisionImageError("Empty image payload")

  let input: Buffer
  try {
    input = Buffer.from(payload, "base64")
  } catch {
    throw new InvalidVisionImageError("Invalid base64 image data")
  }

  if (input.length < 32) {
    throw new InvalidVisionImageError("Scan image is too small")
  }

  try {
    return await sharp(input, { failOn: "none" })
      .rotate()
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer()
  } catch {
    throw new InvalidVisionImageError("Could not decode scan image")
  }
}

/** Server-only Scrydex Vision identify via multipart JPEG upload. */
export async function scrydexVisionIdentify(
  imageBase64: string,
  games?: TcgGame[],
  ledger = new CreditLedger(),
): Promise<ScrydexVisionResponse> {
  const apiKey = process.env.SCRYDEX_API_KEY?.trim()
  const teamId = process.env.SCRYDEX_TEAM_ID?.trim()
  if (!apiKey || !teamId) {
    throw new Error("SCRYDEX_API_KEY and SCRYDEX_TEAM_ID must be configured")
  }

  const path = "/vision/v1/cards/identify"
  await ledger.assertBudget(SCRYDEX_CREDIT_COST.vision)

  const jpeg = await normalizeVisionImageBytes(imageBase64)
  const form = new FormData()
  form.append("image", new File([jpeg], "scan.jpg", { type: "image/jpeg" }))
  if (games?.length) {
    form.append("games", games.map((g) => SCRYDEX_GAME_PATH[g]).join(","))
  }

  const url = `${SCRYDEX_BASE_URL}${path}`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey,
      "X-Team-ID": teamId,
    },
    body: form,
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new ScrydexApiError(
      response.status,
      `Scrydex ${response.status}: ${body.slice(0, 240) || response.statusText}`,
    )
  }

  await ledger.record({
    endpoint: path,
    credits: SCRYDEX_CREDIT_COST.vision,
    game: games?.[0],
  })

  return (await response.json()) as ScrydexVisionResponse
}
