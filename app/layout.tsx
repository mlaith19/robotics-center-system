import type React from "react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { LanguageProvider } from "@/lib/i18n/context"
import { NotifyProviders } from "@/components/providers/notify-providers"
import { GlobalCenterBrand } from "@/components/global-center-brand"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  const origin = `${proto}://${host}`
  const ogLogoUrl = `${origin}/api/og-logo`

  return {
    title: "מערכת ניהול - מרכז הרובוטיקה",
    description: "מערכת ניהול למרכז הרובוטיקה - ניהול קורסים, תלמידים ולוח זמנים",
    generator: "v0.app",
    openGraph: {
      title: "מערכת ניהול - מרכז הרובוטיקה",
      description: "מערכת ניהול למרכז הרובוטיקה - ניהול קורסים, תלמידים ולוח זמנים",
      images: [{ url: ogLogoUrl }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      images: [ogLogoUrl],
    },
    icons: {
      icon: [
        {
          url: "/icon-light-32x32.png",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: "/icon-dark-32x32.png",
          media: "(prefers-color-scheme: dark)",
        },
        {
          url: "/icon.svg",
          type: "image/svg+xml",
        },
      ],
      apple: "/apple-icon.png",
    },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <LanguageProvider>
          <GlobalCenterBrand />
          {children}
          <NotifyProviders />
          <Analytics />
        </LanguageProvider>
      </body>
    </html>
  )
}
