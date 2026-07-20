import { describe, expect, it } from "vitest"
import { parseBinderSearchTokens, resolveBinderSetIdHint } from "@/lib/trade-binder/pokemon-tcg"

describe("parseBinderSearchTokens", () => {
  it("parses sv set codes without stripping the prefix", () => {
    expect(parseBinderSearchTokens("sv4 198")).toEqual({
      name: "",
      setHint: "sv4",
      number: "198",
    })
    expect(parseBinderSearchTokens("sv4")).toEqual({
      name: "",
      setHint: "sv4",
    })
  })

  it("parses set + number shorthand", () => {
    expect(parseBinderSearchTokens("151 173")).toEqual({
      name: "",
      setHint: "151",
      number: "173",
    })
    expect(parseBinderSearchTokens("sv151 173")).toEqual({
      name: "",
      setHint: "151",
      number: "173",
    })
  })

  it("parses name + set shorthand", () => {
    expect(parseBinderSearchTokens("charizard 151")).toEqual({
      name: "charizard",
      setHint: "151",
    })
    expect(parseBinderSearchTokens("charizard sv4")).toEqual({
      name: "charizard",
      setHint: "sv4",
    })
  })

  it("parses name + number", () => {
    expect(parseBinderSearchTokens("charizard 4")).toEqual({
      name: "charizard",
      number: "4",
    })
    expect(parseBinderSearchTokens("pikachu 173")).toEqual({
      name: "pikachu",
      number: "173",
    })
  })

  it("parses set-only browse", () => {
    expect(parseBinderSearchTokens("151")).toEqual({
      name: "",
      setHint: "151",
    })
    expect(parseBinderSearchTokens("sv151")).toEqual({
      name: "",
      setHint: "151",
    })
  })
})

describe("resolveBinderSetIdHint", () => {
  it("maps common 151 nicknames", () => {
    expect(resolveBinderSetIdHint("151")).toBe("sv3pt5")
    expect(resolveBinderSetIdHint("sv151")).toBe("sv3pt5")
    expect(resolveBinderSetIdHint("sv4")).toBe("sv4")
    expect(resolveBinderSetIdHint("unknown")).toBeNull()
  })
})
