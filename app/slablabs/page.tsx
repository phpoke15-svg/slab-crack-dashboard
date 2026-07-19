import { SlabLabsHub } from "@/components/slabs-labs-hub"
import { JsonLd } from "@/components/seo/json-ld"
import { breadcrumbJsonLd, pageMetadata, softwareApplicationJsonLd } from "@/lib/seo"
import { SLABLABS_HREF } from "@/lib/slabs-labs-routes"

const description =
  "SlabLabs groups SlabCrack arbitrage, SlabPop population filters, and SlabIt PSA 10 submission ROI in one graded slab toolkit."

export const metadata = pageMetadata({
  title: "SlabLabs",
  description,
  path: SLABLABS_HREF,
})

export default function SlabLabsPage() {
  return (
    <>
      <JsonLd
        data={[
          softwareApplicationJsonLd({
            name: "SlabLabs",
            description,
            path: SLABLABS_HREF,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "SlabLabs", path: SLABLABS_HREF },
          ]),
        ]}
      />
      <SlabLabsHub />
    </>
  )
}
