'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/power/toaster'
import type { Traducteur } from '@/lib/i18n'
import { LIMITES_OBJECTIFS, lireObjectif, objectifValide, repereProteines, type ObjectifsNutrition } from '@/lib/nutrition'
import { FeuilleMobile } from '@/components/power/feuille-mobile'

export function FenetreObjectifs({ actuels, t, locale, onFermer, onEnregistre }: {
  actuels: ObjectifsNutrition | null
  t: Traducteur
  locale: string
  onFermer: () => void
  onEnregistre: () => void
}) {
  const [kcal, setKcal] = useState(actuels?.kcal != null ? String(actuels.kcal) : '')
  const [prot, setProt] = useState(actuels?.proteines != null ? String(actuels.proteines) : '')
  const [poids, setPoids] = useState<number | null>(null)
  const [envoi, setEnvoi] = useState(false)

  // Dernier poids de corps : sert au repère de protéines.
  useEffect(() => {
    let annule = false
    supabase.from('bodyweight_logs').select('weight').order('date', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      const valeur = Number(data?.weight)
      if (!annule && Number.isFinite(valeur) && valeur > 0) setPoids(valeur)
    })
    return () => { annule = true }
  }, [])

  const kcalLu = lireObjectif(kcal)
  const protLu = lireObjectif(prot)
  const valide = kcalLu !== 'invalide' && protLu !== 'invalide' && objectifValide(kcalLu, LIMITES_OBJECTIFS.kcal) && objectifValide(protLu, LIMITES_OBJECTIFS.proteines)
  const repere = poids !== null ? repereProteines(poids) : null
  const aDesObjectifs = actuels !== null && (actuels.kcal !== null || actuels.proteines !== null)
  const classeChamp = 'h-12 w-full rounded-xl bg-secondary px-3 text-base font-bold tabular-nums text-foreground outline-none'

  const enregistrer = async (valeurs: ObjectifsNutrition) => {
    setEnvoi(true)
    const { error } = await supabase
      .from('objectifs_nutrition')
      .upsert({ kcal: valeurs.kcal, proteines: valeurs.proteines, modifie_le: new Date().toISOString() }, { onConflict: 'user_id' })
    setEnvoi(false)
    if (error) {
      toast(error.code === 'PGRST205' ? t('objectifsIndisponibles') : t('erreur'), 'error')
      return
    }
    toast(t('objectifsEnregistres'), 'success')
    onEnregistre()
  }

  return (
    <FeuilleMobile titre={t('objectifsDuJour')} libelleFermer={t('fermer')} onFermer={onFermer}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valide && !envoi) void enregistrer({ kcal: kcalLu, proteines: protLu })
        }}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
      >
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('objectifKcal')}</span>
          <input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="numeric" placeholder="2000" className={classeChamp} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('objectifProteines')}</span>
          <input value={prot} onChange={(e) => setProt(e.target.value)} inputMode="numeric" placeholder="120" className={classeChamp} />
        </label>
        {repere && poids !== null && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3">
            <p className="text-xs text-muted-foreground">{t('conseilProteines', { min: repere.min, max: repere.max, poids: poids.toLocaleString(locale) })}</p>
            <button
              type="button"
              onClick={() => setProt(String(repere.conseil))}
              className="h-9 shrink-0 rounded-lg border border-border px-3 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-card"
            >
              {t('utiliserValeur', { n: repere.conseil })}
            </button>
          </div>
        )}
        {!valide && <p className="text-xs font-bold text-destructive">{t('objectifsInvalides')}</p>}
        <button type="submit" disabled={!valide || envoi} className="h-12 w-full rounded-xl bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40">
          {t('enregistrer')}
        </button>
        {aDesObjectifs && (
          <button
            type="button"
            disabled={envoi}
            onClick={() => void enregistrer({ kcal: null, proteines: null })}
            className="h-11 w-full rounded-xl border border-border text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-secondary disabled:opacity-40"
          >
            {t('effacerObjectifs')}
          </button>
        )}
      </form>
    </FeuilleMobile>
  )
}
