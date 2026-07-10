import type { RestockProduct } from "@/lib/restocks/types"

const COOLDOWN_MS = 5 * 60 * 1000
const lastAlertAt = new Map<string, number>()

export async function maybeSendRestockDiscordAlert(product: RestockProduct): Promise<boolean> {
  const webhook =
    process.env.RESTOCKS_DISCORD_WEBHOOK?.trim() ||
    process.env.POKEMON_CENTER_DISCORD_WEBHOOK?.trim()
  if (!webhook) return false

  const last = lastAlertAt.get(product.id) ?? 0
  if (Date.now() - last < COOLDOWN_MS) return false

  const retailer = product.retailer === "walmart" ? "Walmart" : "Pokémon Center"
  const price =
    product.price != null ? ` · $${product.price.toFixed(2)}` : product.msrp != null ? ` · MSRP $${product.msrp.toFixed(2)}` : ""

  const payload = {
    content: [
      `@everyone **Restock — ${retailer}**`,
      product.name + price,
      product.productUrl,
      product.queueLikely ? "_Queue likely on Pokémon Center — open Queue Watch._" : null,
      `_Detected ${new Date(product.lastRestockAt ?? product.updatedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET_`,
    ]
      .filter(Boolean)
      .join("\n"),
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) return false
  lastAlertAt.set(product.id, Date.now())
  return true
}
