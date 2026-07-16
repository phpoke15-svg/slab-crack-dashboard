import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/billing/stripe", () => ({
  getEntitlementsForUser: vi.fn(),
}))

import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { requireGiveawayAccess, requireGiveawayAdminAccess } from "@/lib/giveaway/access"

describe("giveaway access", () => {
  it("allows any signed-in user to participate", async () => {
    await expect(requireGiveawayAccess("user-123")).resolves.toEqual({ ok: true })
    await expect(requireGiveawayAccess("")).resolves.toEqual({
      ok: false,
      error: "Sign in required",
      status: 401,
    })
  })

  it("restricts admin routes to supreme", async () => {
    vi.mocked(getEntitlementsForUser).mockResolvedValue({
      plan: "free",
      supreme: false,
      adFree: false,
      queueWatch: false,
      fullSlabCrack: false,
      customHubLayout: false,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    })

    await expect(requireGiveawayAdminAccess("user-123")).resolves.toEqual({
      ok: false,
      error: "Admin access required",
      status: 403,
    })

    vi.mocked(getEntitlementsForUser).mockResolvedValue({
      plan: "supreme",
      supreme: true,
      adFree: true,
      queueWatch: true,
      fullSlabCrack: true,
      customHubLayout: true,
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    })

    await expect(requireGiveawayAdminAccess("user-123")).resolves.toEqual({ ok: true })
  })
})
