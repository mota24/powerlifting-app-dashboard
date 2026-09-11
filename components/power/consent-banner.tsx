'use client'

import { useSyncExternalStore } from 'react'
import { Analytics } from '@vercel/analytics/next'

const CONSENT_KEY = 'powerapp_analytics_consent'
type Choice = 'accepted' | 'refused' | null

// Choix gardé aussi en mémoire : si le stockage est bloqué, la bannière se ferme quand même.
let choixMemoire: Choice = null
const abonnes = new Set<() => void>()

function lireChoix(): Choice {
  try {
    const saved = localStorage.getItem(CONSENT_KEY)
    if (saved === 'accepted' || saved === 'refused') return saved
  } catch { }
  return choixMemoire
}

function sAbonner(rappel: () => void) {
  abonnes.add(rappel)
  return () => { abonnes.delete(rappel) }
}

export function ConsentBanner() {
  // 'serveur' au rendu statique : rien n'est affiché avant de connaître le choix.
  const choice = useSyncExternalStore<Choice | 'serveur'>(sAbonner, lireChoix, () => 'serveur')

  const decide = (value: Exclude<Choice, null>) => {
    choixMemoire = value
    try { localStorage.setItem(CONSENT_KEY, value) } catch { }
    abonnes.forEach((rappel) => rappel())
  }

  if (choice === 'serveur') return null

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
