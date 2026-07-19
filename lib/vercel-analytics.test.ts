import { describe, expect, it } from "vitest"
import { isVercelAnalyticsConfigured } from "@/lib/vercel-analytics"

describe("isVercelAnalyticsConfigured", () => {
  it("is false without token and project id", () => {
    const prevToken = process.env.VERCEL_ANALYTICS_TOKEN
    const prevProject = process.env.VERCEL_PROJECT_ID
    delete process.env.VERCEL_ANALYTICS_TOKEN
    delete process.env.VERCEL_ACCESS_TOKEN
    delete process.env.VERCEL_TOKEN
    delete process.env.VERCEL_PROJECT_ID
    expect(isVercelAnalyticsConfigured()).toBe(false)
    process.env.VERCEL_ANALYTICS_TOKEN = prevToken
    process.env.VERCEL_PROJECT_ID = prevProject
  })
})
