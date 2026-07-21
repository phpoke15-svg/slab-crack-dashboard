/** Common Pokédex # → species name for set+number disambiguation (e.g. prismatic 196 → Espeon). */
const POKEDEX_SPECIES: Partial<Record<number, string>> = {
  4: "charmander",
  6: "charizard",
  7: "squirtle",
  25: "pikachu",
  39: "jigglypuff",
  54: "psyduck",
  133: "eevee",
  134: "vaporeon",
  135: "jolteon",
  136: "flareon",
  196: "espeon",
  197: "umbreon",
  243: "raikou",
  244: "entei",
  245: "suicune",
  249: "lugia",
  250: "ho-oh",
  384: "rayquaza",
  445: "garchomp",
  448: "lucario",
  700: "sylveon",
}

export function pokedexSpeciesName(dexNumber: number): string | null {
  if (!Number.isFinite(dexNumber) || dexNumber <= 0) return null
  return POKEDEX_SPECIES[dexNumber] ?? null
}
