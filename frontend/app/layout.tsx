import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"

import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "Sonja - Digitale Marketeer | AFAS",
  description:
    "Jouw AI-gedreven marketing assistent voor AFAS Software. Chat, analyseer en optimaliseer je marketing strategie.",
}

export const viewport: Viewport = {
  themeColor: "#0066CC",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
