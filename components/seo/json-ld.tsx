type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[]
}

/** Safe JSON-LD script for search engines. */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
