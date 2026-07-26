'use client'

import { useEffect, useState } from 'react'
import { Card, CardTitle } from '@/components/power/card'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/power/toaster'
import { calculateIPFGL } from '@/lib/powerlifting'
import { cn } from '@/lib/utils'
import { Award, Calendar, Camera, Loader2, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react'

interface Competition {
  id: string
  name: string
  date: string
  category: string | null
  bodyweight: number | null
  squat: number | null
  bench: number | null
  deadlift: number | null
  photo_url: string | null
}

const emptyForm = {
  name: '',
  date: '',
  category: '',
  bodyweight: '',
  squat: '',
  bench: '',
  deadlift: '',
  photoUrl: '' as string | null,
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function Palmares() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchCompetitions = async () => {
    try {
      const { data, error } = await supabase.from('competitions').select('*').order('date', { ascending: false })
      if (error) throw error
      setCompetitions((data ?? []) as Competition[])
    } catch (e) {
      console.error(e)
      toast('Erreur de chargement du palmarès', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompetitions()
  }, [])

  const openAddForm = () => {
    setEditingId(null)
    setForm({ ...emptyForm, date: todayStr() })
    setShowForm(true)
  }

  const openEditForm = (comp: Competition) => {
    setEditingId(comp.id)
    setForm({
      name: comp.name,
      date: comp.date,
      category: comp.category ?? '',
      bodyweight: comp.bodyweight != null ? String(comp.bodyweight) : '',
      squat: comp.squat != null ? String(comp.squat) : '',
      bench: comp.bench != null ? String(comp.bench) : '',
      deadlift: comp.deadlift != null ? String(comp.deadlift) : '',
      photoUrl: comp.photo_url,
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/palmares/photo', { method: 'POST', body })
      const json = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Échec upload')
      setForm((prev) => ({ ...prev, photoUrl: json.url as string }))
    } catch (e) {
      toast("Échec de l'envoi de la photo", 'error')
      console.error(e)
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
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        date: form.date,
        category: form.category.trim() || null,
        bodyweight: form.bodyweight ? parseFloat(form.bodyweight) : null,
        squat: form.squat ? parseFloat(form.squat) : null,
        bench: form.bench ? parseFloat(form.bench) : null,
        deadlift: form.deadlift ? parseFloat(form.deadlift) : null,
        photo_url: form.photoUrl || null,
      }
      const { error } = editingId
        ? await supabase.from('competitions').update(payload).eq('id', editingId)
        : await supabase.from('competitions').insert([payload])
      if (error) throw error
      toast(editingId ? 'Compétition mise à jour' : 'Compétition ajoutée', 'success')
      closeForm()
      fetchCompetitions()
    } catch (e) {
      toast('Erreur lors de la sauvegarde', 'error')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette compétition ?')) return
    try {
      const { error } = await supabase.from('competitions').delete().eq('id', id)
      if (error) throw error
      setCompetitions((prev) => prev.filter((c) => c.id !== id))
      toast('Compétition supprimée', 'success')
    } catch (e) {
      toast('Erreur lors de la suppression', 'error')
      console.error(e)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-8">
        <CardTitle icon={Trophy} title="Palmarès" hint="Historique de compétitions" />
        {!showForm && (
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-zinc-200 transition-colors"
          >
            <Plus className="size-3.5" /> Ajouter
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 space-y-4 rounded-2xl border border-zinc-900 bg-black p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {editingId ? 'Modifier la compétition' : 'Nouvelle compétition'}
            </h3>
            <button type="button" onClick={closeForm} className="text-zinc-500 hover:text-white transition-colors">
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nom de la compétition">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Championnat régional"
                className="w-full bg-zinc-900 rounded-lg p-3 text-white text-sm font-bold outline-none focus:ring-1 focus:ring-white placeholder:text-zinc-700"
                required
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full bg-zinc-900 rounded-lg p-3 text-white text-sm font-bold outline-none focus:ring-1 focus:ring-white [color-scheme:dark]"
                required
              />
            </Field>
            <Field label="Catégorie">
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                placeholder="Ex: -83kg Open"
                className="w-full bg-zinc-900 rounded-lg p-3 text-white text-sm font-bold outline-none focus:ring-1 focus:ring-white placeholder:text-zinc-700"
              />
            </Field>
            <Field label="Poids de corps (kg)">
              <input
                type="number"
                step="0.1"
                value={form.bodyweight}
                onChange={(e) => setForm((p) => ({ ...p, bodyweight: e.target.value }))}
                placeholder="Ex: 82.4"
                className="w-full bg-zinc-900 rounded-lg p-3 text-white text-sm font-bold tabular-nums outline-none focus:ring-1 focus:ring-white placeholder:text-zinc-700"
              />
            </Field>
            <Field label="Squat (kg)">
              <input
                type="number"
                step="0.5"
                value={form.squat}
                onChange={(e) => setForm((p) => ({ ...p, squat: e.target.value }))}
                className="w-full bg-zinc-900 rounded-lg p-3 text-white text-sm font-bold tabular-nums outline-none focus:ring-1 focus:ring-white"
              />
            </Field>
            <Field label="Bench (kg)">
              <input
                type="number"
                step="0.5"
                value={form.bench}
                onChange={(e) => setForm((p) => ({ ...p, bench: e.target.value }))}
                className="w-full bg-zinc-900 rounded-lg p-3 text-white text-sm font-bold tabular-nums outline-none focus:ring-1 focus:ring-white"
              />
            </Field>
            <Field label="Deadlift (kg)">
              <input
                type="number"
                step="0.5"
                value={form.deadlift}
                onChange={(e) => setForm((p) => ({ ...p, deadlift: e.target.value }))}
                className="w-full bg-zinc-900 rounded-lg p-3 text-white text-sm font-bold tabular-nums outline-none focus:ring-1 focus:ring-white"
              />
            </Field>
            <Field label="Photo de l'événement">
              <label className="flex items-center justify-center gap-2 w-full bg-zinc-900 rounded-lg p-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white cursor-pointer transition-colors">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                {form.photoUrl ? 'Remplacer' : 'Choisir un fichier'}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" disabled={uploading} />
              </label>
            </Field>
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="w-full py-3 rounded-lg bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editingId ? 'Enregistrer' : 'Ajouter au palmarès'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12 text-zinc-600">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : competitions.length === 0 ? (
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600 py-12">
          Aucune compétition enregistrée
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitions.map((comp) => (
            <CompetitionCard key={comp.id} comp={comp} onEdit={() => openEditForm(comp)} onDelete={() => handleDelete(comp.id)} />
          ))}
        </div>
      )}
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  )
}

function CompetitionCard({ comp, onEdit, onDelete }: { comp: Competition; onEdit: () => void; onDelete: () => void }) {
  const total = (comp.squat ?? 0) + (comp.bench ?? 0) + (comp.deadlift ?? 0)
  const hasResults = total > 0
  const glScore = hasResults && comp.bodyweight ? calculateIPFGL(total, comp.bodyweight) : 0
  const isUpcoming = comp.date > todayStr()
  const formattedDate = new Date(comp.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-900 bg-black">
      <div className="relative h-36 w-full bg-zinc-900">
        {comp.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comp.photo_url} alt={comp.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Trophy className="size-8 text-zinc-800" />
          </div>
        )}

        {isUpcoming && (
          <span className="absolute top-3 right-3 rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-black">
            À venir
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-black/80 px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white truncate">{comp.name}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400">
            <Calendar className="size-3" /> {formattedDate}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          <span>{comp.category || '—'}</span>
          <span>PDC {comp.bodyweight ? `${comp.bodyweight} kg` : '—'}</span>
        </div>

        {hasResults ? (
          <div className="grid grid-cols-5 gap-1 border-t border-zinc-900 pt-4">
            <StatCell label="SQ" value={comp.squat} />
            <StatCell label="BP" value={comp.bench} />
            <StatCell label="DL" value={comp.deadlift} />
            <StatCell label="TOTAL" value={total} emphasis />
            <StatCell label="GL" value={glScore > 0 ? glScore.toFixed(2) : null} emphasis />
          </div>
        ) : (
          <p className="border-t border-zinc-900 pt-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Résultats à venir
          </p>
        )}

        <div className="flex justify-end gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-2 text-zinc-500 hover:text-white rounded-lg transition-colors">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={onDelete} className="p-2 text-zinc-500 hover:text-red-400 rounded-lg transition-colors">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCell({ label, value, emphasis }: { label: string; value: number | string | null; emphasis?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-0.5">
        {emphasis && label === 'TOTAL' && <Award className="size-2.5" />}
        {label}
      </span>
      <span className={cn('font-mono tabular-nums text-xs sm:text-sm font-black mt-0.5', emphasis ? 'text-white' : 'text-zinc-300')}>
        {value ?? '—'}
      </span>
    </div>
  )
}
