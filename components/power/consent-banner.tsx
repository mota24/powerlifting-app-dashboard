'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/next'

// RGPD / ePrivacy : la mesure d'audience (Vercel Analytics) traite l'adresse IP.
// Elle n'est chargée qu'APRÈS un consentement explicite. Tant qu'aucun choix
// n'est fait, un bandeau discret propose Accepter / Refuser ; le choix est
// mémorisé localement et Analytics ne se charge jamais sans "accepted".
const CONSENT_KEY = 'powerapp_analytics_consent'

type Choice = 'accepted' | 'refused' | null

export function ConsentBanner() {
  const [mounted, setMounted] = useState(false)
  const [choice, setChoice] = useState<Choice>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONSENT_KEY)
      setChoice(saved === 'accepted' ? 'accepted' : saved === 'refused' ? 'refused' : null)
    } catch { /* stockage inaccessible : on reste en attente de choix */ }
    setMounted(true)
  }, [])

  const decide = (value: Exclude<Choice, null>) => {
    try { localStorage.setItem(CONSENT_KEY, value) } catch { /* navigation privée */ }
    setChoice(value)
  }

  // Rien tant que le choix n'est pas lu côté client (évite tout chargement
  // d'Analytics avant consentement et tout décalage d'hydratation).
  if (!mounted) return null

  return (
    <>
      {choice === 'accepted' && process.env.NODE_ENV === 'production' && <Analytics />}

      {choice === null && (
        <div className="fixed bottom-0 inset-x-0 z-[120] p-3 sm:p-4">
          <div className="mx-auto max-w-2xl rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <p className="text-xs text-slate-300 flex-1 leading-relaxed">
              On utilise une mesure d&apos;audience anonyme (qui traite ton adresse IP) pour améliorer l&apos;app.
              Tu peux l&apos;accepter ou la refuser.{' '}
              <a href="/confidentialite" className="text-blue-400 underline hover:text-blue-300">En savoir plus</a>.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => decide('refused')}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Refuser
              </button>
              <button
                onClick={() => decide('accepted')}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                Accepter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
