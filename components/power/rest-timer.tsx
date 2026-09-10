'use client'

import { useEffect, useState } from 'react'
import { Play, Square, Plus, Minus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/app/ThemeContext'

const PRESETS = [30, 45, 60, 90, 120, 180]
const CLE_DUREE = 'powerapp_temps_repos'
const DUREE_DEFAUT = 90
const DUREE_MIN = 15
const DUREE_MAX = 600
const PAS_REGLAGE = 15
const AFFICHAGE_FIN_MS = 6000

let audioCtx: AudioContext | null = null

// iOS ne débloque le son qu'à l'intérieur d'un geste utilisateur : on
// l'appelle dans le clic de lancement, pas au moment où le repos se termine.
function debloquerAudio() {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new Ctor()
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume()
  } catch { }
}

function bip(frequence: number, duree: number, delai = 0) {
  if (!audioCtx) return
  try {
    const debut = audioCtx.currentTime + delai
    const oscillateur = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    oscillateur.frequency.setValueAtTime(frequence, debut)
    gain.gain.setValueAtTime(0, debut)
    gain.gain.linearRampToValueAtTime(0.5, debut + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, debut + duree)
    oscillateur.connect(gain)
    gain.connect(audioCtx.destination)
    oscillateur.start(debut)
    oscillateur.stop(debut + duree)
  } catch { }
}

function lireDuree(): number {
  if (typeof window === 'undefined') return DUREE_DEFAUT
  try {
    const valeur = Number(localStorage.getItem(CLE_DUREE))
    return Number.isFinite(valeur) && valeur >= DUREE_MIN && valeur <= DUREE_MAX ? valeur : DUREE_DEFAUT
  } catch {
    return DUREE_DEFAUT
  }
}

const formater = (secondes: number) => `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`

type Etat = 'pret' | 'en_cours' | 'termine'

/**
 * Minuteur de repos entre les séries. La durée est choisie une fois puis
 * mémorisée sur l'appareil ; un appui lance le décompte.
 *
 * Le décompte repose sur une heure de fin absolue, pas sur un compteur
 * décrémenté : un intervalle est ralenti quand l'onglet passe en arrière-plan,
 * l'heure de fin, elle, reste juste au retour.
 */
export function RestTimer() {
  const t = useT()
  const [duree, setDuree] = useState(lireDuree)
  const [etat, setEtat] = useState<Etat>('pret')
  const [fin, setFin] = useState(0)
  const [total, setTotal] = useState(0)
  const [restant, setRestant] = useState(0)
  const [choixOuvert, setChoixOuvert] = useState(false)

  const changerDuree = (secondes: number) => {
    const valeur = Math.min(DUREE_MAX, Math.max(DUREE_MIN, secondes))
    setDuree(valeur)
    try { localStorage.setItem(CLE_DUREE, String(valeur)) } catch { }
  }

  const lancer = () => {
    debloquerAudio()
    setFin(Date.now() + duree * 1000)
    setTotal(duree)
    setRestant(duree)
    setChoixOuvert(false)
    setEtat('en_cours')
    navigator.vibrate?.(60)
  }

  const prolonger = () => {
    setFin((f) => f + PAS_REGLAGE * 1000)
    setTotal((d) => d + PAS_REGLAGE)
    setRestant((r) => r + PAS_REGLAGE)
  }

  useEffect(() => {
    if (etat !== 'en_cours') return
    let dernierBip = -1
    const id = setInterval(() => {
      const maintenant = Date.now()
      const secondes = Math.max(0, Math.ceil((fin - maintenant) / 1000))
      setRestant(secondes)
      if (secondes > 0 && secondes <= 3 && secondes !== dernierBip) {
        dernierBip = secondes
        bip(660, 0.12)
      }
      if (secondes === 0) {
        // Échéance passée pendant que l'écran était éteint : un signal en
        // retard serait plus déroutant qu'utile, on affiche juste la fin.
        if (maintenant - fin < 2000) {
          bip(880, 0.18)
          bip(880, 0.18, 0.25)
          bip(1175, 0.35, 0.5)
          navigator.vibrate?.([200, 100, 200, 100, 400])
        }
        setEtat('termine')
      }
    }, 200)
    return () => clearInterval(id)
  }, [etat, fin])

  useEffect(() => {
    if (etat !== 'termine') return
    const id = setTimeout(() => setEtat('pret'), AFFICHAGE_FIN_MS)
    return () => clearTimeout(id)
  }, [etat])

  // Garde l'écran allumé pendant le repos : un téléphone qui se verrouille
  // suspend le JavaScript, donc le signal de fin ne sonnerait pas.
  useEffect(() => {
    if (etat !== 'en_cours') return
    let verrou: WakeLockSentinel | null = null
    let actif = true
    const demander = async () => {
      try {
        if ('wakeLock' in navigator) verrou = await navigator.wakeLock.request('screen')
      } catch { }
    }
    void demander()
    const auRetour = () => { if (actif && document.visibilityState === 'visible') void demander() }
    document.addEventListener('visibilitychange', auRetour)
    return () => {
      actif = false
      document.removeEventListener('visibilitychange', auRetour)
      verrou?.release().catch(() => { })
    }
  }, [etat])

  const progression = total > 0 ? (restant / total) * 100 : 0

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="mx-auto max-w-5xl pointer-events-auto">
        {choixOuvert && etat === 'pret' && (
          <div className="mb-2 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3 shadow-xl">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => { changerDuree(preset); setChoixOuvert(false) }}
                className={cn(
                  'h-12 rounded-xl text-sm font-black tabular-nums transition-colors',
                  preset === duree ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-accent'
                )}
              >
                {formater(preset)}
              </button>
            ))}
          </div>
        )}

        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border shadow-xl',
            etat === 'termine' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'
          )}
        >
          {etat === 'en_cours' && (
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-200 ease-linear"
              style={{ width: `${progression}%` }}
            />
          )}

          <div className="relative flex items-center gap-2 p-2">
            {etat === 'pret' && (
              <>
                <button
                  onClick={() => changerDuree(duree - PAS_REGLAGE)}
                  aria-label={`-${PAS_REGLAGE} s`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground hover:bg-accent"
                >
                  <Minus className="size-4" />
                </button>
                <button
                  onClick={() => setChoixOuvert((o) => !o)}
                  aria-expanded={choixOuvert}
                  aria-label={`${t('choisirDuree')} (${formater(duree)})`}
                  className="h-12 min-w-16 shrink-0 rounded-xl px-2 text-lg font-black tabular-nums text-foreground hover:bg-secondary"
                >
                  {formater(duree)}
                </button>
                <button
                  onClick={() => changerDuree(duree + PAS_REGLAGE)}
                  aria-label={`+${PAS_REGLAGE} s`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground hover:bg-accent"
                >
                  <Plus className="size-4" />
                </button>
                {/* Libellé visible court : sur 320-375 px, la phrase complète ne
                    tient pas à côté des réglages. Elle reste le nom accessible. */}
                <button
                  onClick={lancer}
                  aria-label={t('lancerRepos')}
                  className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-[11px] font-black uppercase tracking-wider text-primary-foreground hover:opacity-90"
                >
                  <Play className="size-4 shrink-0" />
                  <span className="truncate">{t('reposCourt')}</span>
                </button>
              </>
            )}

            {etat === 'en_cours' && (
              <>
                <div className="min-w-0 flex-1 pl-3">
                  <div className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('reposCourt')}</div>
                  <div role="timer" className="text-3xl font-black tabular-nums leading-none">{formater(restant)}</div>
                </div>
                <button
                  onClick={prolonger}
                  className="h-12 shrink-0 rounded-xl bg-secondary px-4 text-sm font-black tabular-nums text-foreground hover:bg-accent"
                >
                  +{PAS_REGLAGE} s
                </button>
                <button
                  onClick={() => setEtat('pret')}
                  className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-border px-4 text-[11px] font-black uppercase tracking-widest text-foreground hover:bg-secondary"
                >
                  <Square className="size-3.5" />
                  {t('arreter')}
                </button>
              </>
            )}

            {etat === 'termine' && (
              <button
                onClick={() => setEtat('pret')}
                className="flex h-12 w-full items-center justify-center gap-2 text-sm font-black uppercase tracking-widest"
              >
                <Check className="size-5" />
                <span aria-live="assertive">{t('reposTermine')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
