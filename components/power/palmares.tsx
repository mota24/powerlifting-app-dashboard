'use client'

import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, Loader2, Plus, Table2, Trophy } from 'lucide-react'
import { Card, CardTitle } from '@/components/power/card'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/power/toaster'
import { proposerAnnulation } from '@/lib/annulation'
import { cn } from '@/lib/utils'
import { LIFTS, bestValid, createEmptyForm, formFrom, num, safeHttpUrl, type Competition, type FormState, type VueMode } from '@/lib/palmares'
import { PalmaresTable } from '@/components/power/palmares-tableau'
import { CompetitionCard } from '@/components/power/palmares-carte'
import { CompetitionDetail } from '@/components/power/palmares-detail'
import { CompetitionForm } from '@/components/power/palmares-formulaire'

// ————————————————————————————————————————————————
// Palmarès
// ————————————————————————————————————————————————

interface PalmaresProps {
  /** Ouvre directement le formulaire d'édition de cette compétition (ex :
   * bouton "Saisir mes résultats" de l'écran Jour J). */
  initialEditId?: string | null
  /** Appelé une fois l'ouverture automatique effectuée, pour que le parent
   * efface son état (sinon rouvrir le Palmarès rouvrirait toujours le
   * même formulaire, même après que l'utilisateur l'ait fermé). */
  onInitialEditConsumed?: () => void
}

export function Palmares({ initialEditId, onInitialEditConsumed }: PalmaresProps = {}) {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(createEmptyForm)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [vue, setVue] = useState<VueMode>('cartes')

  const [version, setVersion] = useState(0)
  const recharger = () => setVersion((v) => v + 1)
  // Ouverture automatique depuis l'écran Jour J : une seule fois, au premier chargement.
  const editionInitiale = useRef({ id: initialEditId, consommer: onInitialEditConsumed })

  useEffect(() => {
    let cancelled = false
    supabase.from('competitions').select('*').order('date', { ascending: false }).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) {
        toast('Erreur de chargement du palmarès', 'error')
        return
      }
      const liste = (data ?? []) as Competition[]
      setCompetitions(liste)
      const { id, consommer } = editionInitiale.current
      const aEditer = id ? liste.find((c) => c.id === id) : undefined
      if (!aEditer) return
      editionInitiale.current = { id: null, consommer: undefined }
      setEditingId(aEditer.id)
      setForm(formFrom(aEditer))
      setShowForm(true)
      consommer?.()
    })
    return () => { cancelled = true }
  }, [version])

  const detail = competitions.find((c) => c.id === detailId) ?? null

  const openAddForm = () => {
    setEditingId(null)
    setForm(createEmptyForm())
    setShowForm(true)
  }

  const openEditForm = (comp: Competition) => {
    setEditingId(comp.id)
    setForm(formFrom(comp))
    setDetailId(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(createEmptyForm())
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const body = new FormData()
      for (const file of Array.from(files)) body.append('file', file)
      const res = await fetch('/api/palmares/photo', { method: 'POST', body })
      const json = (await res.json()) as { urls?: string[]; error?: string }
      if (!res.ok || !json.urls) throw new Error(json.error ?? 'Échec upload')
      const urls = json.urls
      setForm((prev) => ({ ...prev, photoUrls: [...prev.photoUrls, ...urls] }))
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'envoi des photos", 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.date) {
      toast('Nom et date requis', 'error')
      return
    }
    // Plutôt que d'ignorer silencieusement un lien mal formé.
    if (form.videoUrl.trim() && !safeHttpUrl(form.videoUrl)) {
      toast('Le lien vidéo doit commencer par http:// ou https://', 'error')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        date: form.date,
        category: form.category.trim() || null,
        level: form.level.trim() || null,
        country_code: form.countryCode || null,
        placement: num(form.placement),
        video_url: safeHttpUrl(form.videoUrl),
        bodyweight: num(form.bodyweight),
        photo_urls: form.photoUrls,
      }

      for (const { key } of LIFTS) {
        const attempts = form.attempts[key].map(num)
        payload[`${key}_1`] = attempts[0]
        payload[`${key}_2`] = attempts[1]
        payload[`${key}_3`] = attempts[2]
        // La meilleure barre validée prime sur la saisie manuelle dès qu'un
        // essai est renseigné : les deux ne peuvent pas se contredire.
        const derived = bestValid(attempts)
        payload[key] = derived > 0 ? derived : num(form.best[key])
      }

      const { error } = editingId
        ? await supabase.from('competitions').update(payload).eq('id', editingId)
        : await supabase.from('competitions').insert([payload])
      if (error) throw error

      toast(editingId ? 'Compétition mise à jour' : 'Compétition ajoutée', 'success')
      closeForm()
      recharger()
    } catch {
      toast('Erreur lors de la sauvegarde', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette compétition ?')) return
    // Copie complète (chargée via select('*')) : c'est elle qu'on réinsère si
    // la suppression est annulée. Les photos ne sont pas effacées du stockage,
    // elles reviennent donc avec la ligne.
    const copie = competitions.find((c) => c.id === id)
    try {
      const { error } = await supabase.from('competitions').delete().eq('id', id)
      if (error) throw error
      setCompetitions((prev) => prev.filter((c) => c.id !== id))
      setDetailId(null)
      if (!copie) {
        toast('Compétition supprimée', 'success')
        return
      }
      proposerAnnulation({
        message: 'Compétition supprimée',
        libelleBouton: 'Annuler',
        annuler: async () => {
          const { error: erreurRestauration } = await supabase.from('competitions').insert([copie])
          if (erreurRestauration) {
            toast('Restauration impossible', 'error')
            return false
          }
          recharger()
          toast('Compétition restaurée', 'success')
          return true
        },
      })
    } catch {
      toast('Erreur lors de la suppression', 'error')
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <CardTitle icon={Trophy} title="Palmarès" hint="Historique de compétitions" />

        <div className="flex items-center gap-2">
          {/* Libellés masqués sous 640px : les icônes suffisent et l'en-tête
              tient sur une ligne, même à 375px de large. */}
          <div className="flex bg-zinc-900 p-1 rounded-xl">
            {([
              { key: 'cartes', label: 'Cartes', Icon: LayoutGrid },
              { key: 'tableau', label: 'Tableau', Icon: Table2 },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setVue(key)}
                aria-pressed={vue === key}
                aria-label={`Vue ${label}`}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors',
                  vue === key ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {!showForm && (
            <button
              onClick={openAddForm}
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-zinc-200 transition-colors"
            >
              <Plus className="size-3.5 shrink-0" /> Ajouter
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <CompetitionForm
          form={form}
          setForm={setForm}
          editing={editingId !== null}
          saving={saving}
          uploading={uploading}
          onPhotoChange={handlePhotoChange}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12 text-zinc-600">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : competitions.length === 0 ? (
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600 py-12">
          Aucune compétition enregistrée
        </p>
      ) : vue === 'cartes' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitions.map((comp) => (
            <CompetitionCard
              key={comp.id}
              comp={comp}
              onOpen={() => setDetailId(comp.id)}
              onEdit={() => openEditForm(comp)}
              onDelete={() => handleDelete(comp.id)}
            />
          ))}
        </div>
      ) : (
        <PalmaresTable competitions={competitions} onOpen={setDetailId} />
      )}

      {detail && (
        <CompetitionDetail
          comp={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => openEditForm(detail)}
          onDelete={() => handleDelete(detail.id)}
        />
      )}
    </Card>
  )
}
