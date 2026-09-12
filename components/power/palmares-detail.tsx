'use client'

import { useCallback, useState } from 'react'
import { Calendar, CirclePlay, Medal, Pencil, Trash2, X } from 'lucide-react'
import { useModale } from '@/lib/use-modale'
import { LIFTS, attemptsOf, bestLift, formatDate, formatKg, formatPlacement, glOf, safeHttpUrl, totalOf, type Competition } from '@/lib/palmares'
import { AttemptValue, CountryFlag } from '@/components/power/palmares-elements'

// ————————————————————————————————————————————————
// Vue détaillée : feuille de match + galerie
// ————————————————————————————————————————————————

export function CompetitionDetail({
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

  const fermerZoom = useCallback(() => setZoom(null), [])
  // Échap referme d'abord la photo plein écran, puis la fiche.
  useModale(zoom ? fermerZoom : onClose)

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
