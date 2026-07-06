import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AdSenseScript } from '@/components/adsense-script'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'SlabCrack — Graded Slab Arbitrage for TCG Collectors',
  description:
    'Find graded PSA slabs selling for less than a raw Near-Mint copy. Buy, crack, and binder your cards at a discount.',
  generator: 'v0.app',
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
      <body className="font-sans antialiased bg-background text-foreground">
        <AdSenseScript />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
