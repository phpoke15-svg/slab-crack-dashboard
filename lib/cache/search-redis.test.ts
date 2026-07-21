import { describe, expect, it } from "vitest"
import { buildSearchRedisKey } from "@/lib/cache/search-redis"

describe("buildSearchRedisKey", () => {
  it("builds pokemon search cache keys from clean names", () => {
    expect(buildSearchRedisKey("Charizard (Holo)")).toBe("search:pokemon:charizard holo")
  })
})
