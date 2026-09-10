'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, LayoutTemplate, RefreshCw, Trash2, X } from 'lucide-react'
import { useT } from '@/app/ThemeContext'
import { toast } from '@/components/power/toaster'
import { proposerAnnulation } from '@/lib/annulation'
import type { Traducteur } from '@/lib/i18n'
import { MODELES_MAX, NOM_MODELE_MAX, normaliserModele, versModele, type ExerciceSource, type ModeleSeance } from '@/lib/modeles'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

/** Ligne « Modèles de séance », qui ouvre la fenêtre pour enregistrer ou charger un modèle. */
export function ModelesSeance({ exercices, onCharger }: { exercices: ExerciceSource[]; onCharger: (modele: ModeleSeance) => void }) {
  const t = useT()
  const [ouvert, setOuvert] = useState(false)
  const fermer = useCallback(() => setOuvert(false), [])
  const charger = useCallback((modele: ModeleSeance) => {
    setOuvert(false)
    onCharger(modele)
  }, [onCharger])

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-secondary"
      >
        <LayoutTemplate className="size-4 shrink-0 text-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-widest text-foreground">{t('modelesSeance')}</span>
          <span className="block truncate text-xs text-muted-foreground">{t('modelesAide')}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {ouvert && <FenetreModeles exercices={exercices} t={t} onFermer={fermer} onCharger={charger} />}
    </>
  )
}

function lireZoneVisible(): { haut: number; hauteur: number } | null {
  if (typeof window === 'undefined' || !window.visualViewport) return null
  return { haut: window.visualViewport.offsetTop, hauteur: window.visualViewport.height }
}

function resume(noms: string[], t: Traducteur) {
  const nombre = noms.length === 1 ? t('unExercice') : t('nExercices', { n: noms.length })
  return `${nombre} · ${noms.slice(0, 3).join(', ')}${noms.length > 3 ? '…' : ''}`
}

function FenetreModeles({ exercices, t, onFermer, onCharger }: {
  exercices: ExerciceSource[]
  t: Traducteur
  onFermer: () => void
  onCharger: (modele: ModeleSeance) => void
}) {
  const [version, setVersion] = useState(0)
  const [charge, setCharge] = useState<{ version: number; modeles: ModeleSeance[] | 'indisponible' } | null>(null)
  const [nom, setNom] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [zoneVisible, setZoneVisible] = useState(lireZoneVisible)

  useEffect(() => {
    let annule = false
    supabase
      .from('modeles_seance')
      .select('id, nom, exercices')
      .order('nom', { ascending: true })
      .then(({ data, error }) => {
        if (annule) return
        const modeles = error ? 'indisponible' : (data ?? []).map(normaliserModele).filter((m): m is ModeleSeance => m !== null)
        setCharge({ version, modeles })
      })
    return () => { annule = true }
  }, [version])

  // Fenêtre calée sur la zone visible : le clavier du téléphone ne la recouvre pas.
  useEffect(() => {
    const vue = window.visualViewport
    if (!vue) return
    const suivre = () => setZoneVisible({ haut: vue.offsetTop, hauteur: vue.height })
    vue.addEventListener('resize', suivre)
    vue.addEventListener('scroll', suivre)
    return () => {
      vue.removeEventListener('resize', suivre)
      vue.removeEventListener('scroll', suivre)
    }
  }, [])

  useEffect(() => {
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', surTouche)
    return () => {
      document.body.style.overflow = precedent
      window.removeEventListener('keydown', surTouche)
    }
  }, [onFermer])

  const actuel = charge && charge.version === version ? charge.modeles : null
  const modeles = Array.isArray(actuel) ? actuel : []
  const aEnregistrer = versModele(exercices)
  const nomPropre = nom.trim().slice(0, NOM_MODELE_MAX)
  const existant = modeles.find((m) => m.nom.toLocaleLowerCase() === nomPropre.toLocaleLowerCase())
  const peutEnregistrer = !envoi && nomPropre !== '' && aEnregistrer.length > 0 && Array.isArray(actuel)

  const enregistrer = async () => {
    if (!peutEnregistrer) return
    if (!existant && modeles.length >= MODELES_MAX) {
      toast(t('modelesMax', { max: MODELES_MAX }), 'error')
      return
    }
    setEnvoi(true)
    // Même nom qu'un modèle existant : on le met à jour plutôt que de créer un doublon.
    const { error } = existant
      ? await supabase.from('modeles_seance').update({ exercices: aEnregistrer, modifie_le: new Date().toISOString() }).eq('id', existant.id)
      : await supabase.from('modeles_seance').insert([{ nom: nomPropre, exercices: aEnregistrer }])
    setEnvoi(false)
    if (error) {
      toast(t('erreur'), 'error')
      return
    }
    toast(existant ? t('modeleMisAJour', { nom: existant.nom }) : t('modeleEnregistre', { nom: nomPropre }), 'success')
    setNom('')
    setVersion((v) => v + 1)
  }

  const supprimer = async (modele: ModeleSeance) => {
    const { error } = await supabase.from('modeles_seance').delete().eq('id', modele.id)
    if (error) {
      toast(t('erreur'), 'error')
      return
    }
    setCharge((c) => (c && Array.isArray(c.modeles) ? { ...c, modeles: c.modeles.filter((m) => m.id !== modele.id) } : c))
    proposerAnnulation({
      message: t('modeleSupprime'),
      libelleBouton: t('annuler'),
      annuler: async () => {
        const { error: erreurRestauration } = await supabase.from('modeles_seance').insert([{ id: modele.id, nom: modele.nom, exercices: modele.exercices }])
        if (erreurRestauration) {
          toast(t('restaurationImpossible'), 'error')
          return false
        }
        setVersion((v) => v + 1)
        toast(t('restaure'), 'success')
        return true
      },
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('modelesSeance')}
      style={zoneVisible ? { top: zoneVisible.haut, height: zoneVisible.hauteur } : undefined}
      className={cn('fixed inset-x-0 z-[100] flex items-end justify-center overflow-hidden bg-black/90 pt-6 sm:items-center sm:p-4', !zoneVisible && 'inset-y-0')}
    >
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:max-h-[92dvh] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{t('modelesSeance')}</h2>
          <button onClick={onFermer} aria-label={t('fermer')} className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          <form onSubmit={(e) => { e.preventDefault(); void enregistrer() }} className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('enregistrerSeanceModele')}</p>
            {aEnregistrer.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('seanceVidePourModele')}</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    maxLength={NOM_MODELE_MAX}
                    placeholder={t('exempleNomModele')}
                    aria-label={t('nomDuModele')}
                    className="h-12 min-w-0 flex-1 rounded-xl bg-secondary px-3 text-base font-bold text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    disabled={!peutEnregistrer}
                    className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
                  >
                    {envoi ? <RefreshCw className="size-4 animate-spin" /> : t('enregistrer')}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {existant ? t('modeleSeraRemplace') : resume(aEnregistrer.map((ex) => ex.nom), t)}
                </p>
              </>
            )}
          </form>

          <section className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('mesModeles')}</p>
            {actuel === null ? (
              <div className="flex justify-center py-6 text-muted-foreground"><RefreshCw className="size-5 animate-spin" /></div>
            ) : actuel === 'indisponible' ? (
              <p className="text-sm text-muted-foreground">{t('modelesIndisponibles')}</p>
            ) : modeles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('aucunModele')}</p>
            ) : (
              <ul className="space-y-2">
                {modeles.map((modele) => (
                  <li key={modele.id} className="flex items-center gap-2 rounded-xl bg-secondary p-2 pl-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{modele.nom}</p>
                      <p className="truncate text-xs text-muted-foreground">{resume(modele.exercices.map((ex) => ex.nom), t)}</p>
                    </div>
                    <button
                      onClick={() => onCharger(modele)}
                      className="h-10 shrink-0 rounded-lg bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90"
                    >
                      {t('charger')}
                    </button>
                    <button
                      onClick={() => void supprimer(modele)}
                      aria-label={t('supprimer')}
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
