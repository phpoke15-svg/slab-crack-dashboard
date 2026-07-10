import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AdSenseScript } from '@/components/adsense-script'
import { AppProviders } from '@/components/app-providers'
import { getSiteUrl } from '@/lib/site-url'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'CollecTools — TCG Collector Toolkit',
    template: '%s · CollecTools',
  },
  description:
    'SlabCrack arbitrage, Restocks, PokeMatch trading, and Queue Watch for Pokémon TCG collectors.',
  applicationName: 'CollecTools',
  openGraph: {
    type: 'website',
    siteName: 'CollecTools',
    title: 'CollecTools — TCG Collector Toolkit',
    description:
      'SlabCrack arbitrage, Restocks, PokeMatch trading, and Queue Watch for Pokémon TCG collectors.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary',
    title: 'CollecTools — TCG Collector Toolkit',
    description:
      'SlabCrack arbitrage, Restocks, PokeMatch trading, and Queue Watch for Pokémon TCG collectors.',
  },
  other: {
    'google-adsense-account': 'ca-pub-8023063687308230',
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        },
      }
    : {}),
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b0e14',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <AdSenseScript />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
