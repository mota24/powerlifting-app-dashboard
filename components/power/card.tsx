import { cn } from '../../lib/utils'

export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-900 bg-zinc-950 p-6 sm:p-8',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  hint?: string
}) {
  return (
    <div className="mb-8 flex items-center gap-3">
      {Icon ? <Icon className="size-5 text-white shrink-0" /> : null}
      <div>
        <h2 className="text-sm font-bold tracking-widest text-white uppercase">
          {title}
        </h2>
        {hint ? (
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}