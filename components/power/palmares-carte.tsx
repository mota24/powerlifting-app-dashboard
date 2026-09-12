'use client'

import { Calendar, CirclePlay, Medal, Pencil, Trash2, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LIFTS, bestLift, formatDate, formatKg, formatPlacement, glOf, safeHttpUrl, todayStr, totalOf, type Competition } from '@/lib/palmares'
import { CountryFlag } from '@/components/power/palmares-elements'

// ————————————————————————————————————————————————
// Carte résumé
// ————————————————————————————————————————————————

export function CompetitionCard({
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
