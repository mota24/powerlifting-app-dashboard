'use client'

import { useEffect, useRef, useState } from 'react'
import { Apple, BarChart2, Calculator, Home, Images, KeyRound, LogOut, Medal, Menu, Settings, Timer, Trophy, Wrench, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/app/ThemeContext'
import type { Vue } from '@/lib/navigation'

/** Titre de l'écran courant, retour à l'accueil et menu des autres écrans. */
export function BarreNavigation({ vueActive, onChangerVue, estFitness, onChrono, onMotDePasse, onDeconnexion }: {
  vueActive: Vue
  onChangerVue: (vue: Vue) => void
  estFitness: boolean
  onChrono: () => void
  onMotDePasse: () => void
  onDeconnexion: () => void
}) {
  const t = useT()
  const [menuOuvert, setMenuOuvert] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const toggleBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const auClicExterieur = (event: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        toggleBtnRef.current && !toggleBtnRef.current.contains(event.target as Node)
      ) {
        setMenuOuvert(false)
      }
    }
    document.addEventListener('mousedown', auClicExterieur)
    return () => document.removeEventListener('mousedown', auClicExterieur)
  }, [])

  const aller = (vue: Vue) => {
    setMenuOuvert(false)
    onChangerVue(vue)
  }

  const classeEntree = (vue: Vue) => cn(
    'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
    vueActive === vue ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary text-foreground'
  )

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 flex justify-between items-center relative z-30 bg-background">
      <div className="flex flex-col">
        <h2 className="text-sm font-medium text-muted-foreground capitalize">
          {vueActive === 'analytique' && t('analytique')}
          {vueActive === 'outils' && t('outils')}
          {vueActive === 'calculatrice' && t('calculatrice')}
          {vueActive === 'configuration' && t('gestionBlocs')}
          {vueActive === 'palmares' && t('palmares')}
          {vueActive === 'classement' && t('classement')}
          {vueActive === 'nutrition' && t('nutrition')}
          {vueActive === 'photos' && t('photos')}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => aller('accueil')}
          className={cn(
            'flex items-center justify-center p-2 rounded-md border transition-colors',
            vueActive === 'accueil'
              ? 'bg-primary/10 border-primary/20 text-primary'
              : 'bg-secondary border-border hover:bg-accent text-muted-foreground hover:text-accent-foreground'
          )}
          title={t('retourAccueil')}
        >
          <Home className="size-5" />
        </button>

        <div className="relative">
          <button
            ref={toggleBtnRef}
            onClick={() => setMenuOuvert(!menuOuvert)}
            className="flex items-center justify-center p-2 rounded-md bg-secondary hover:bg-accent border border-border transition-colors text-foreground"
          >
            {menuOuvert ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          {menuOuvert && (
            <div
              ref={menuRef}
              className="absolute top-12 right-0 w-56 bg-card border border-border p-2 rounded-lg shadow-xl flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-200"
            >
              <button onClick={() => aller('analytique')} className={classeEntree('analytique')}><BarChart2 className="size-4" /> {t('analytique')}</button>
              <button onClick={() => aller('outils')} className={classeEntree('outils')}><Wrench className="size-4" /> {t('outils')}</button>
              <button onClick={() => aller('calculatrice')} className={classeEntree('calculatrice')}><Calculator className="size-4" /> {t('calculatrice')}</button>
              {!estFitness && (
                <button onClick={() => aller('palmares')} className={classeEntree('palmares')}><Trophy className="size-4" /> {t('palmares')}</button>
              )}
              <button onClick={() => aller('classement')} className={classeEntree('classement')}><Medal className="size-4" /> {t('classement')}</button>
              <button onClick={() => aller('nutrition')} className={classeEntree('nutrition')}><Apple className="size-4" /> {t('nutrition')}</button>
              <button onClick={() => aller('photos')} className={classeEntree('photos')}><Images className="size-4" /> {t('photos')}</button>
              <button onClick={() => { setMenuOuvert(false); onChrono() }} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary text-foreground"><Timer className="size-4" /> {t('chronoCircuit')}</button>

              <div className="h-px bg-border my-1"></div>

              <button onClick={() => aller('configuration')} className={classeEntree('configuration')}><Settings className="size-4" /> {t('mesBlocs')}</button>

              <div className="h-px bg-border my-1"></div>

              <button onClick={() => { setMenuOuvert(false); onMotDePasse() }} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary text-foreground">
                <KeyRound className="size-4" /> {t('motDePasse')}
              </button>

              <button onClick={onDeconnexion} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-destructive/10 text-destructive font-medium">
                <LogOut className="size-4" /> {t('seDeconnecter')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
