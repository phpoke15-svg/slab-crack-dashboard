/** Strip data-URL prefix and whitespace from a base64 camera capture. */
export function stripVisionImageBase64(value: string): string {
  const trimmed = value.trim()
  const payload = trimmed.includes(",") ? (trimmed.split(",").pop() ?? "") : trimmed
  return payload.replace(/\s/g, "")
}
