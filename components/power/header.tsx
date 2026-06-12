'use client'

import { cn } from '@/lib/utils'
import { Zap, Flame } from 'lucide-react'

export function Header({
  peaking,
  onTogglePeaking,
}: {
  peaking: boolean
  onTogglePeaking: () => void
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Zap className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              PowerApp
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Powerlifting Performance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {peaking ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary sm:flex">
              <Flame className="size-3.5" />
              Volume réduit · Focus Intensité
            </span>
          ) : null}
          <button
            type="button"
            role="switch"
            aria-checked={peaking}
            onClick={onTogglePeaking}
            className="flex items-center gap-2"
          >
            <span className="text-xs font-semibold text-foreground">
              Mode Peaking
            </span>
            <span
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                peaking ? 'bg-primary' : 'bg-secondary',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-5 rounded-full bg-background shadow-md transition-transform',
                  peaking ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {peaking ? (
        <div className="bg-primary/10 px-4 py-1.5 text-center sm:hidden">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <Flame className="size-3.5" />
            Volume réduit · Focus Intensité
          </span>
        </div>
      ) : null}
    </header>
  )
}
