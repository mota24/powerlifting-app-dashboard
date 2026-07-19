import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/power/toaster'
import { ConsentBanner } from '@/components/power/consent-banner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PowerApp ',
  description: 'PWA de Powerlifting de haut niveau : suivi RPE, 1RM estimé, plate math, échauffement et alertes de sécurité.',
  generator: 'v0.app',
  
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      {/* Remplacement de bg-background par bg-black et ajout du style de sélection Brutaliste */}
      <body className="bg-black text-white font-sans antialiased selection:bg-white selection:text-black" suppressHydrationWarning>
        {children}
        <Toaster />
        <ConsentBanner />
      </body>
    </html>
  )
}