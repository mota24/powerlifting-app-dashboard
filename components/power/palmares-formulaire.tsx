'use client'

import { Camera, Loader2, X } from 'lucide-react'
import { COUNTRIES, countryCodeToFlag } from '@/lib/countries'
import { LIFTS, NIVEAUX, bestValid, num, type FormState, type LiftKey } from '@/lib/palmares'

// ————————————————————————————————————————————————
// Formulaire d'ajout / édition
// ————————————————————————————————————————————————

export function CompetitionForm({
  form,
  setForm,
  editing,
  saving,
  uploading,
  onPhotoChange,
  onSubmit,
  onCancel,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  editing: boolean
  saving: boolean
  uploading: boolean
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}) {
  const inputClass =
    'w-full bg-zinc-900 rounded-lg p-3 text-white text-sm font-bold outline-none focus:ring-1 focus:ring-white placeholder:text-zinc-700'
  const numClass = `${inputClass} font-mono tabular-nums text-center`

  const setAttempt = (lift: LiftKey, index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      attempts: {
        ...prev.attempts,
        [lift]: prev.attempts[lift].map((a, i) => (i === index ? value : a)),
      },
    }))
  }

  const removePhoto = (url: string) => {
    setForm((prev) => ({ ...prev, photoUrls: prev.photoUrls.filter((u) => u !== url) }))
  }

  return (
    // overflow-x-hidden : filet de sécurité, coupe tout élément qui
    // tenterait malgré tout de déborder plutôt que d'élargir la page.
    <form onSubmit={onSubmit} className="mb-8 w-full max-w-full space-y-6 overflow-x-hidden rounded-2xl border border-zinc-900 bg-black p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          {editing ? 'Modifier la compétition' : 'Nouvelle compétition'}
        </h3>
        <button type="button" onClick={onCancel} aria-label="Annuler" className="text-zinc-500 hover:text-white transition-colors">
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nom de la compétition">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Ex: Campeonato de España Junior"
            className={inputClass}
            required
          />
        </Field>
        <Field label="Date">
          {/* iOS Safari donne aux parties internes (shadow DOM) d'un
              <input type="date"> une largeur qui résiste à w-full seul.
              appearance-none retire le chrome natif qu'Apple dessine par-
              dessus — sans lui, min-w-0/max-w-full n'ont aucun effet sur
              cet input précis, même s'ils suffisent partout ailleurs. */}
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            className={`${inputClass} [color-scheme:dark] min-w-0 max-w-full appearance-none box-border`}
            required
          />
        </Field>
        <Field label="Niveau">
          <input
            type="text"
            list="palmares-niveaux"
            value={form.level}
            onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
            placeholder="Ex: National"
            className={inputClass}
          />
          <datalist id="palmares-niveaux">
            {NIVEAUX.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
        <Field label="Pays">
          {/* Le nom du pays apparaît ici pour rendre la saisie utilisable,
              mais jamais sur les cartes : seul l'émoji y est affiché. */}
          <select
            value={form.countryCode}
            onChange={(e) => setForm((p) => ({ ...p, countryCode: e.target.value }))}
            className={`${inputClass} [color-scheme:dark]`}
          >
            <option value="">— Aucun</option>
            {COUNTRIES.map((pays) => (
              <option key={pays.code} value={pays.code}>
                {countryCodeToFlag(pays.code)} {pays.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Catégorie">
          <input
            type="text"
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            placeholder="Ex: -120kg Junior"
            className={inputClass}
          />
        </Field>
        <Field label="Classement">
          <input
            type="number"
            min="1"
            step="1"
            value={form.placement}
            onChange={(e) => setForm((p) => ({ ...p, placement: e.target.value }))}
            placeholder="Ex: 1"
            className={numClass}
          />
        </Field>
        <Field label="Poids de corps (kg)">
          <input
            type="number"
            step="0.01"
            value={form.bodyweight}
            onChange={(e) => setForm((p) => ({ ...p, bodyweight: e.target.value }))}
            placeholder="Ex: 117.2"
            className={numClass}
          />
        </Field>
        <div className="sm:col-span-2 min-w-0">
          <Field label="Lien de la rediffusion (YouTube, live…)">
            <input
              type="url"
              inputMode="url"
              value={form.videoUrl}
              onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=…"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3 border-t border-zinc-900 pt-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Les 9 essais</p>
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 leading-relaxed">
          Essai manqué : saisis la charge en négatif (ex : −175). Laisse vide si non tenté.
          La meilleure barre validée est calculée automatiquement.
        </p>

        <div className="space-y-2">
          {LIFTS.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[10rem_1fr] items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
              <div className="grid grid-cols-3 gap-2">
                {form.attempts[key].map((value, i) => (
                  <input
                    key={i}
                    type="number"
                    step="0.5"
                    value={value}
                    onChange={(e) => setAttempt(key, i, e.target.value)}
                    placeholder={`E${i + 1}`}
                    aria-label={`${label} essai ${i + 1}`}
                    className={numClass}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-zinc-900 pt-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Meilleures barres <span className="text-zinc-600">— si les essais ne sont pas détaillés</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LIFTS.map(({ key, short }) => (
            <Field key={key} label={short}>
              <input
                type="number"
                step="0.5"
                value={form.best[key]}
                onChange={(e) => setForm((p) => ({ ...p, best: { ...p.best, [key]: e.target.value } }))}
                disabled={bestValid(form.attempts[key].map(num)) > 0}
                className={`${numClass} disabled:opacity-40`}
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-zinc-900 pt-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Photos</p>

        {form.photoUrls.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {form.photoUrls.map((url) => (
              <div key={url} className="relative aspect-4/3 overflow-hidden rounded-lg bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  aria-label="Retirer la photo"
                  className="absolute top-1 right-1 rounded-full bg-black/80 p-1 text-zinc-300 hover:text-white transition-colors"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="flex items-center justify-center gap-2 w-full bg-zinc-900 rounded-lg p-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white cursor-pointer transition-colors">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {uploading ? 'Envoi…' : 'Ajouter des photos'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={onPhotoChange}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={saving || uploading}
        className="w-full py-3 rounded-lg bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        {editing ? 'Enregistrer' : 'Ajouter au palmarès'}
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // min-w-0 : par défaut, un item de grid ne rétrécit jamais sous la
  // largeur intrinsèque de son contenu (min-width: auto implicite). Un
  // <input type="date"> a un rendu natif qui ne se compresse pas bien, il
  // débordait donc de sa colonne malgré le w-full posé sur l'input — le
  // w-full n'a d'effet que si le conteneur est autorisé à être plus étroit.
  return (
    <div className="space-y-1.5 min-w-0">
      <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  )
}
