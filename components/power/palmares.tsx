'use client'

import { useEffect, useState } from 'react'
import { Card, CardTitle } from '@/components/power/card'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/power/toaster'
import { calculateIPFGL } from '@/lib/powerlifting'
import { COUNTRIES, countryCodeToFlag, countryName } from '@/lib/countries'
import { cn } from '@/lib/utils'
import { Calendar, Camera, CirclePlay, LayoutGrid, Loader2, Medal, Pencil, Plus, Table2, Trash2, Trophy, X } from 'lucide-react'

// ————————————————————————————————————————————————
// Modèle
//
// Les essais suivent la convention OpenPowerlifting : valeur positive =
// essai validé, valeur négative = essai manqué, null = non tenté.
// ————————————————————————————————————————————————

type LiftKey = 'squat' | 'bench' | 'deadlift'

const LIFTS: { key: LiftKey; label: string; short: string }[] = [
  { key: 'squat', label: 'Squat', short: 'SQ' },
  { key: 'bench', label: 'Dév. Couché', short: 'BP' },
  { key: 'deadlift', label: 'S. de Terre', short: 'DL' },
]

/** Niveaux proposés en autocomplétion — le champ reste libre. */
const NIVEAUX = ['Régional', 'AEP 1', 'AEP 2', 'National', 'International']

type VueMode = 'cartes' | 'tableau'

interface Competition {
  id: string
  name: string
  date: string
  category: string | null
  level: string | null
  /** Code ISO 3166-1 alpha-2 ; le drapeau en est dérivé à l'affichage. */
  country_code: string | null
  placement: number | null
  /** Rediffusion / live de la compétition (YouTube ou autre). */
  video_url: string | null
  bodyweight: number | null
  squat: number | null
  bench: number | null
  deadlift: number | null
  squat_1: number | null
  squat_2: number | null
  squat_3: number | null
  bench_1: number | null
  bench_2: number | null
  bench_3: number | null
  deadlift_1: number | null
  deadlift_2: number | null
  deadlift_3: number | null
  photo_urls: string[] | null
}

type Attempt = number | null

/** Les 3 essais d'un mouvement, dans l'ordre de passage. */
function attemptsOf(comp: Competition, lift: LiftKey): Attempt[] {
  switch (lift) {
    case 'squat':
      return [comp.squat_1, comp.squat_2, comp.squat_3]
    case 'bench':
      return [comp.bench_1, comp.bench_2, comp.bench_3]
    case 'deadlift':
      return [comp.deadlift_1, comp.deadlift_2, comp.deadlift_3]
  }
}

function storedBest(comp: Competition, lift: LiftKey): number | null {
  switch (lift) {
    case 'squat':
      return comp.squat
    case 'bench':
      return comp.bench
    case 'deadlift':
      return comp.deadlift
  }
}

/** Meilleure barre validée d'une série d'essais (0 si aucune réussie). */
function bestValid(attempts: Attempt[]): number {
  return attempts.reduce<number>((best, a) => (a != null && a > best ? a : best), 0)
}

/**
 * Meilleure barre du mouvement : dérivée des essais dès qu'au moins un est
 * saisi (source de vérité), sinon la valeur enregistrée seule.
 */
function bestLift(comp: Competition, lift: LiftKey): number {
  const fromAttempts = bestValid(attemptsOf(comp, lift))
  if (fromAttempts > 0) return fromAttempts
  const stored = storedBest(comp, lift)
  return stored != null && stored > 0 ? stored : 0
}

function totalOf(comp: Competition): number {
  return LIFTS.reduce((sum, l) => sum + bestLift(comp, l.key), 0)
}

function glOf(comp: Competition): number {
  const total = totalOf(comp)
  return total > 0 && comp.bodyweight ? calculateIPFGL(total, comp.bodyweight) : 0
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPlacement(placement: number): string {
  return placement === 1 ? '1er' : `${placement}e`
}

/** Affichage d'un poids : décimale seulement si utile (167,5 mais 295). */
function formatKg(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

// ————————————————————————————————————————————————
// Formulaire
// ————————————————————————————————————————————————

interface FormState {
  name: string
  date: string
  category: string
  level: string
  countryCode: string
  placement: string
  videoUrl: string
  bodyweight: string
  best: Record<LiftKey, string>
  attempts: Record<LiftKey, string[]>
  photoUrls: string[]
}

function createEmptyForm(): FormState {
  return {
    name: '',
    date: todayStr(),
    category: '',
    level: '',
    countryCode: '',
    placement: '',
    videoUrl: '',
    bodyweight: '',
    best: { squat: '', bench: '', deadlift: '' },
    attempts: { squat: ['', '', ''], bench: ['', '', ''], deadlift: ['', '', ''] },
    photoUrls: [],
  }
}

function formFrom(comp: Competition): FormState {
  const str = (v: number | null) => (v != null ? String(v) : '')
  return {
    name: comp.name,
    date: comp.date,
    category: comp.category ?? '',
    level: comp.level ?? '',
    countryCode: comp.country_code ?? '',
    placement: str(comp.placement),
    videoUrl: comp.video_url ?? '',
    bodyweight: str(comp.bodyweight),
    best: {
      squat: str(comp.squat),
      bench: str(comp.bench),
      deadlift: str(comp.deadlift),
    },
    attempts: {
      squat: attemptsOf(comp, 'squat').map(str),
      bench: attemptsOf(comp, 'bench').map(str),
      deadlift: attemptsOf(comp, 'deadlift').map(str),
    },
    photoUrls: comp.photo_urls ?? [],
  }
}

/**
 * Une URL saisie librement finit dans un href : on n'accepte que http(s).
 * Un lien « javascript:… » y serait une faille XSS, et « data: » permettrait
 * d'injecter une page arbitraire. Tout le reste est ignoré.
 */
function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

/** Champ numérique optionnel : vide ou invalide → null. */
function num(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parseFloat(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

// ————————————————————————————————————————————————
// Palmarès
// ————————————————————————————————————————————————

export function Palmares() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(createEmptyForm)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [vue, setVue] = useState<VueMode>('cartes')

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
      console.error(err)
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
      fetchCompetitions()
    } catch (err) {
      toast('Erreur lors de la sauvegarde', 'error')
      console.error(err)
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
      setDetailId(null)
      toast('Compétition supprimée', 'success')
    } catch (err) {
      toast('Erreur lors de la suppression', 'error')
      console.error(err)
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

// ————————————————————————————————————————————————
// Vue tableau (style OpenPowerlifting)
// ————————————————————————————————————————————————

/**
 * Tableau dense de toutes les compétitions. Le conteneur porte
 * `overflow-x-auto` et la table `min-w-max` : les colonnes gardent leur
 * largeur naturelle et c'est LE TABLEAU qui défile horizontalement, jamais
 * la page. Sans `min-w-max`, la table se comprimerait dans le conteneur au
 * lieu de déborder, rendant les chiffres illisibles sur mobile.
 */
function PalmaresTable({ competitions, onOpen }: { competitions: Competition[]; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-950">
      <table className="min-w-max w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-zinc-900 bg-black">
            <Th rowSpan={2}>#</Th>
            <Th rowSpan={2}>Date</Th>
            <Th rowSpan={2} align="center">Lieu</Th>
            <Th rowSpan={2}>Compétition</Th>
            <Th rowSpan={2}>Niveau</Th>
            <Th rowSpan={2}>Division</Th>
            <Th rowSpan={2} align="right">PDC</Th>
            {LIFTS.map(({ key, label }) => (
              <Th key={key} colSpan={3} align="center" className="border-l border-zinc-900">
                {label}
              </Th>
            ))}
            <Th rowSpan={2} align="right" className="border-l border-zinc-900">Total</Th>
            <Th rowSpan={2} align="right">IPF GL</Th>
          </tr>
          <tr className="border-b border-zinc-900 bg-black">
            {LIFTS.flatMap(({ key }) =>
              [1, 2, 3].map((n) => (
                <Th key={`${key}-${n}`} align="center" className={n === 1 ? 'border-l border-zinc-900' : undefined}>
                  {n}
                </Th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {competitions.map((comp) => {
            const total = totalOf(comp)
            const gl = glOf(comp)
            return (
              <tr
                key={comp.id}
                onClick={() => onOpen(comp.id)}
                className="border-b border-zinc-900/60 last:border-0 cursor-pointer transition-colors hover:bg-zinc-900/40"
              >
                <Td className="font-mono tabular-nums text-zinc-400">
                  {comp.placement != null ? comp.placement : '—'}
                </Td>
                <Td className="font-mono tabular-nums text-zinc-400">{comp.date}</Td>
                <Td align="center">
                  <CountryFlag code={comp.country_code} />
                </Td>
                <Td className="font-bold uppercase tracking-widest text-white text-[10px]">
                  {/* Borne la colonne : un nom a rallonge etirerait toute la table. */}
                  <span className="block max-w-[220px] truncate" title={comp.name}>
                    {comp.name}
                  </span>
                </Td>
                <Td className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{comp.level || '—'}</Td>
                <Td className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{comp.category || '—'}</Td>
                <Td align="right" className="font-mono tabular-nums text-zinc-300">
                  {comp.bodyweight != null ? formatKg(comp.bodyweight) : '—'}
                </Td>
                {LIFTS.flatMap(({ key }) =>
                  attemptsOf(comp, key).map((attempt, i) => (
                    <Td key={`${key}-${i}`} align="center" className={i === 0 ? 'border-l border-zinc-900' : undefined}>
                      <AttemptValue value={attempt} />
                    </Td>
                  ))
                )}
                <Td align="right" className="border-l border-zinc-900 font-mono tabular-nums font-black text-white">
                  {total > 0 ? formatKg(total) : '—'}
                </Td>
                <Td align="right" className="font-mono tabular-nums font-black text-white">
                  {gl > 0 ? gl.toFixed(2) : '—'}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const ALIGNS = { left: 'text-left', center: 'text-center', right: 'text-right' } as const

function Th({
  children,
  align = 'left',
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: keyof typeof ALIGNS }) {
  return (
    <th
      {...props}
      className={cn(
        'px-3 py-2.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest text-zinc-500',
        ALIGNS[align],
        className
      )}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  className,
}: {
  children: React.ReactNode
  align?: keyof typeof ALIGNS
  className?: string
}) {
  return <td className={cn('px-3 py-3 whitespace-nowrap text-sm', ALIGNS[align], className)}>{children}</td>
}

// ————————————————————————————————————————————————
// Carte résumé
// ————————————————————————————————————————————————

function CompetitionCard({
  comp,
  onOpen,
  onEdit,
  onDelete,
}: {
  comp: Competition
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const total = totalOf(comp)
  const gl = glOf(comp)
  const cover = comp.photo_urls?.[0]
  const isUpcoming = comp.date > todayStr()

  // Les boutons vivent dans la carte cliquable : sans stopPropagation, un
  // clic sur « modifier » ouvrirait aussi la vue détaillée.
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="group relative overflow-hidden rounded-2xl border border-zinc-900 bg-black text-left cursor-pointer transition-colors hover:border-zinc-700 focus:outline-none focus-visible:border-white"
    >
      <div className="relative h-36 w-full bg-zinc-900">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={comp.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Trophy className="size-8 text-zinc-800" />
          </div>
        )}

        {safeHttpUrl(comp.video_url) && (
          <span
            role="img"
            aria-label="Rediffusion disponible"
            className="absolute top-3 left-3 rounded-full bg-black/80 p-1.5 text-white"
          >
            <CirclePlay className="size-3.5" />
          </span>
        )}

        {isUpcoming && (
          <span className="absolute top-3 right-3 rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-black">
            À venir
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-black/80 px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white truncate">{comp.name}</h3>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <Calendar className="size-3" /> {formatDate(comp.date)}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest">
          {/* Niveau puis drapeau : le texte seul est tronqué, l'émoji ne l'est jamais. */}
          <span className="flex min-w-0 items-center gap-1.5 text-zinc-400">
            <span className="truncate">{comp.level || comp.category || '—'}</span>
            <CountryFlag code={comp.country_code} />
          </span>
          {comp.placement != null && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-white">
              <Medal className="size-3" /> {formatPlacement(comp.placement)}
            </span>
          )}
        </div>

        {total > 0 ? (
          <div className="grid grid-cols-5 gap-1 border-t border-zinc-900 pt-4">
            {LIFTS.map((l) => (
              <StatCell key={l.key} label={l.short} value={bestLift(comp, l.key)} />
            ))}
            <StatCell label="Total" value={total} emphasis />
            <StatCell label="IPF GL" value={gl > 0 ? gl.toFixed(2) : null} emphasis />
          </div>
        ) : (
          <p className="border-t border-zinc-900 pt-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Résultats à venir
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-600">
            {comp.bodyweight ? `PDC ${formatKg(comp.bodyweight)} kg` : 'PDC —'}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button onClick={stop(onEdit)} aria-label="Modifier" className="p-2 text-zinc-500 hover:text-white rounded-lg transition-colors">
              <Pencil className="size-3.5" />
            </button>
            <button onClick={stop(onDelete)} aria-label="Supprimer" className="p-2 text-zinc-500 hover:text-red-400 rounded-lg transition-colors">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Drapeau du pays, émoji seul — le nom n'est jamais écrit à l'écran, il ne
 * sert que d'étiquette d'accessibilité (invisible, lue par les lecteurs
 * d'écran). `tracking-normal` annule le letter-spacing hérité du texte
 * environnant, qui décalerait l'émoji vers la gauche, et `leading-none`
 * l'empêche d'augmenter la hauteur de ligne.
 */
function CountryFlag({ code }: { code: string | null }) {
  const flag = countryCodeToFlag(code)
  if (!flag) return null
  return (
    <span
      role="img"
      aria-label={countryName(code) ?? 'Pays'}
      className="shrink-0 text-[13px] leading-none tracking-normal"
    >
      {flag}
    </span>
  )
}

function StatCell({ label, value, emphasis }: { label: string; value: number | string | null; emphasis?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      <span
        className={cn(
          'mt-0.5 font-mono text-xs sm:text-sm font-black tabular-nums',
          emphasis ? 'text-white' : 'text-zinc-300'
        )}
      >
        {typeof value === 'number' ? (value > 0 ? formatKg(value) : '—') : value ?? '—'}
      </span>
    </div>
  )
}

// ————————————————————————————————————————————————
// Vue détaillée : feuille de match + galerie
// ————————————————————————————————————————————————

function CompetitionDetail({
  comp,
  onClose,
  onEdit,
  onDelete,
}: {
  comp: Competition
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [zoom, setZoom] = useState<string | null>(null)
  const photos = comp.photo_urls ?? []
  // Revalidé à l'affichage : une valeur douteuse en base ne doit pas
  // atterrir dans un href, même si la saisie la filtre déjà.
  const video = safeHttpUrl(comp.video_url)
  const total = totalOf(comp)
  const gl = glOf(comp)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // La photo plein écran se referme avant la modale elle-même.
      setZoom((current) => {
        if (current) return null
        onClose()
        return null
      })
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/90 p-4 sm:p-8 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-zinc-900 bg-zinc-950 p-4 sm:p-8 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-black uppercase tracking-widest text-white">{comp.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3" /> {formatDate(comp.date)}
              </span>
              {(comp.level || comp.country_code) && (
                <span className="flex items-center gap-1.5 text-zinc-400">
                  {comp.level}
                  <CountryFlag code={comp.country_code} />
                </span>
              )}
              {comp.category && <span>{comp.category}</span>}
              {comp.placement != null && (
                <span className="flex items-center gap-1 text-white">
                  <Medal className="size-3" /> {formatPlacement(comp.placement)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="shrink-0 p-2 text-zinc-500 hover:text-white transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-8">
          <Scoresheet comp={comp} total={total} gl={gl} />
        </div>

        {photos.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Photos · {photos.length}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((url) => (
                <button
                  key={url}
                  onClick={() => setZoom(url)}
                  className="group relative aspect-4/3 overflow-hidden rounded-lg bg-zinc-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={comp.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-900 pt-6">
          {video && (
            <a
              href={video}
              target="_blank"
              // noreferrer/noopener : la page ouverte ne doit pas pouvoir
              // manipuler la nôtre via window.opener.
              rel="noopener noreferrer"
              className="mr-auto flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-zinc-800 transition-colors"
            >
              <CirclePlay className="size-3.5 shrink-0" /> Rediffusion
            </a>
          )}
          <button
            onClick={onEdit}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-zinc-800 transition-colors"
          >
            <Pencil className="size-3.5" /> Modifier
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="size-3.5" /> Supprimer
          </button>
        </div>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation()
            setZoom(null)
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt={comp.name} className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            onClick={(e) => {
              e.stopPropagation()
              setZoom(null)
            }}
            aria-label="Fermer la photo"
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Feuille de match : les 9 essais, un mouvement par ligne. Un essai validé
 * s'affiche en blanc, un essai manqué est grisé, barré et gardé en négatif
 * (convention OpenPowerlifting) pour rester identifiable d'un coup d'œil.
 */
function Scoresheet({ comp, total, gl }: { comp: Competition; total: number; gl: number }) {
  const hasAttempts = LIFTS.some(({ key }) => attemptsOf(comp, key).some((a) => a != null))

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-900">
      {/* Sur téléphone, chaque libellé passe à sa forme courte et le padding
          se resserre : la feuille tient dans la modale sans défilement. Tout
          est en whitespace-nowrap — sans quoi « Essai 3 » se coupait en deux
          lignes. */}
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-zinc-900 bg-black">
            <th className="whitespace-nowrap px-1.5 py-3 text-[9px] font-bold uppercase tracking-widest text-zinc-500 sm:px-4">
              <span className="sm:hidden">Mvt</span>
              <span className="hidden sm:inline">Mouvement</span>
            </th>
            {[1, 2, 3].map((n) => (
              <th
                key={n}
                className="whitespace-nowrap px-1 py-3 text-center text-[9px] font-bold uppercase tracking-widest text-zinc-500 sm:px-3"
              >
                <span className="hidden sm:inline">Essai </span>
                {n}
              </th>
            ))}
            <th className="whitespace-nowrap px-1.5 py-3 text-right text-[9px] font-bold uppercase tracking-widest text-zinc-500 sm:px-4">
              <span className="sm:hidden">Max</span>
              <span className="hidden sm:inline">Meilleur</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {LIFTS.map(({ key, label, short }) => {
            const attempts = attemptsOf(comp, key)
            const best = bestLift(comp, key)
            return (
              <tr key={key} className="border-b border-zinc-900/60 last:border-0">
                <td className="whitespace-nowrap px-1.5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-300 sm:px-4">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </td>
                {attempts.map((attempt, i) => (
                  <td key={i} className="whitespace-nowrap px-1 py-3 text-center sm:px-3">
                    <AttemptValue value={attempt} />
                  </td>
                ))}
                <td className="whitespace-nowrap px-1.5 py-3 text-right font-mono text-sm font-black tabular-nums text-white sm:px-4">
                  {best > 0 ? formatKg(best) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-800 bg-black">
            <td className="whitespace-nowrap px-1.5 py-3 text-[9px] font-bold uppercase tracking-widest text-zinc-500 sm:px-4">
              Total
            </td>
            <td colSpan={2} className="whitespace-nowrap px-1 py-3 font-mono text-base font-black tabular-nums text-white sm:px-3 sm:text-lg">
              {total > 0 ? `${formatKg(total)} kg` : '—'}
            </td>
            <td className="whitespace-nowrap px-1 py-3 text-right text-[9px] font-bold uppercase tracking-widest text-zinc-500 sm:px-3">
              IPF GL
            </td>
            <td className="whitespace-nowrap px-1.5 py-3 text-right font-mono text-base font-black tabular-nums text-white sm:px-4 sm:text-lg">
              {gl > 0 ? gl.toFixed(2) : '—'}
            </td>
          </tr>
        </tfoot>
      </table>

      {!hasAttempts && (
        <p className="border-t border-zinc-900 px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
          Essais non détaillés pour cette compétition
        </p>
      )}
    </div>
  )
}

function AttemptValue({ value }: { value: Attempt }) {
  if (value == null) return <span className="font-mono text-sm text-zinc-800">—</span>
  const failed = value < 0
  return (
    <span
      className={cn(
        'font-mono text-sm font-bold tabular-nums',
        failed ? 'text-zinc-600 line-through decoration-zinc-700' : 'text-white'
      )}
      title={failed ? 'Essai manqué' : 'Essai validé'}
    >
      {failed ? `−${formatKg(Math.abs(value))}` : formatKg(value)}
    </span>
  )
}

// ————————————————————————————————————————————————
// Formulaire d'ajout / édition
// ————————————————————————————————————————————————

function CompetitionForm({
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
    <form onSubmit={onSubmit} className="mb-8 space-y-6 rounded-2xl border border-zinc-900 bg-black p-4 sm:p-6">
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
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            className={`${inputClass} [color-scheme:dark]`}
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
