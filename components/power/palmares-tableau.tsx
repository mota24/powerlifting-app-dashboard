'use client'

import { cn } from '@/lib/utils'
import { LIFTS, attemptsOf, formatKg, glOf, totalOf, type Competition } from '@/lib/palmares'
import { AttemptValue, CountryFlag } from '@/components/power/palmares-elements'

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
export function PalmaresTable({ competitions, onOpen }: { competitions: Competition[]; onOpen: (id: string) => void }) {
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
