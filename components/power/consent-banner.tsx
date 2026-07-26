'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/next'

const CONSENT_KEY = 'powerapp_analytics_consent'
type Choice = 'accepted' | 'refused' | null

export function ConsentBanner() {
  const [mounted, setMounted] = useState(false)
  const [choice, setChoice] = useState<Choice>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONSENT_KEY)
      setChoice(saved === 'accepted' ? 'accepted' : saved === 'refused' ? 'refused' : null)
    } catch { }
    setMounted(true)
  }, [])

  const decide = (value: Exclude<Choice, null>) => {
    try { localStorage.setItem(CONSENT_KEY, value) } catch { }
    setChoice(value)
  }

  if (!mounted) return null

  return (
    <>
      {choice === 'accepted' && process.env.NODE_ENV === 'production' && <Analytics />}

      {choice === null && (
        <div className="fixed bottom-0 inset-x-0 z-[120] p-4 sm:p-6">
          <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-900 bg-black/95 backdrop-blur-md shadow-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex-1 leading-loose">
              NOUS UTILISONS UNE MESURE D&apos;AUDIENCE ANONYME POUR AMÉLIORER L&apos;APP.{' '}
              <a href="/confidentialite" className="text-white underline hover:text-zinc-300">DÉTAILS</a>.
            </p>
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
              <button onClick={() => decide('refused')} className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-[10px] font-black text-white uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 transition-colors">
                REFUSER
              </button>
              <button onClick={() => decide('accepted')} className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-[10px] font-black text-black uppercase tracking-widest bg-white hover:bg-zinc-200 transition-colors">
                ACCEPTER
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}