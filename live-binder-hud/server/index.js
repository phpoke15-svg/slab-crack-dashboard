import path from "node:path"
import { fileURLToPath } from "node:url"
import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import { detectCardsInFrame } from "./gemini.js"
import { priceCard, priceCards } from "./pricecharting.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

dotenv.config({ path: path.join(rootDir, ".env") })
dotenv.config({ path: path.resolve(rootDir, "../.env.local") })
dotenv.config({ path: path.resolve(rootDir, "../.env") })

const app = express()
const PORT = Number(process.env.PORT || 8787)
const staticDir = path.resolve(rootDir, "../public/live-binder-hud")

app.use(cors())
app.use(express.json({ limit: "25mb" }))

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "live-binder-hud",
    mode: "gemini-box_2d",
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    pricecharting: Boolean(process.env.PRICECHARTING_API_KEY?.trim()),
  })
})

/**
 * Full-frame zero-shot detect.
 * Preferred body: { mimeType: "image/jpeg", data: "<base64 without prefix>" }
 * Fallback: { image: "data:image/jpeg;base64,..." }
 */
app.post("/api/scan", async (req, res) => {
  try {
    const { data, mimeType, image } = req.body || {}
    if (!(data && String(data).length > 100) && !(image && String(image).length > 100)) {
      return res.status(400).json({
        ok: false,
        error: "Send mimeType + data (base64 without prefix), or image data URL",
      })
    }
    const result = await detectCardsInFrame({ data, mimeType, image })
    res.json({
      ok: true,
      cards: result.cards,
      model: result.model,
      rawJson: result.rawJson,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed"
    console.error("[api/scan]", message)
    const status = /not configured/i.test(message) ? 503 : 500
    res.status(status).json({ ok: false, error: message })
  }
})

app.post("/api/prices", async (req, res) => {
  try {
    const cards = req.body?.cards
    const apiKey = req.body?.apiKey || req.headers["x-pricecharting-key"]
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ ok: false, error: "cards[] required" })
    }
    const results = await priceCards(cards, apiKey)
    res.json({ ok: true, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Price lookup failed"
    const status = /not configured/i.test(message) ? 503 : 500
    res.status(status).json({ ok: false, error: message })
  }
})

app.get("/api/price", async (req, res) => {
  try {
    const card = {
      slot: Number(req.query.slot || 1),
      name: String(req.query.name || ""),
      set: String(req.query.set || ""),
      number: String(req.query.number || ""),
    }
    if (!card.name) return res.status(400).json({ ok: false, error: "name required" })
    const apiKey = String(req.query.apiKey || req.headers["x-pricecharting-key"] || "")
    const result = await priceCard(card, apiKey)
    res.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Price lookup failed"
    const status = /not configured/i.test(message) ? 503 : 500
    res.status(status).json({ ok: false, error: message })
  }
})

app.use(express.static(staticDir, { extensions: ["html"] }))

app.get("/", (_req, res) => {
  res.sendFile(path.join(staticDir, "app.html"))
})

app.listen(PORT, () => {
  console.log(`Live Binder HUD listening on http://localhost:${PORT}`)
  console.log(`Mode: Gemini box_2d full-frame detect`)
  console.log(`Static: ${staticDir}`)
})
