'use client'

import { useEffect, useState } from 'react'
import { Check, AlertTriangle, Info, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

// Toasts non bloquants (remplacent les alert() qui gelaient la saisie).
// API sans provider : toast() émet un événement window, le <Toaster/> monté
// dans le layout l'affiche. Utilisable depuis n'importe quel composant client.

export type ToastType = 'success' | 'error' | 'info' | 'pr'

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

export function toast(message: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return
  // Émission différée d'un tick : un toast lancé pendant le montage initial
  // (ex. sync des pas) part APRÈS que le Toaster a attaché son écouteur.
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }))
  }, 0)
}

const STYLES: Record<ToastType, { icon: typeof Check; classes: string }> = {
  success: { icon: Check, classes: 'border-emerald-500/30 bg-emerald-950/90 text-emerald-300' },
  error: { icon: AlertTriangle, classes: 'border-red-500/30 bg-red-950/90 text-red-300' },
  info: { icon: Info, classes: 'border-slate-700 bg-slate-900/95 text-slate-200' },
  pr: { icon: Trophy, classes: 'border-yellow-500/40 bg-yellow-950/90 text-yellow-300' },
}

let nextId = 1

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const timeouts = new Set<ReturnType<typeof setTimeout>>()
    const onToast = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail
      const id = nextId++
      // Pile bornée : au-delà de 3 toasts, les plus anciens laissent la place
      setToasts((prev) => [...prev.slice(-2), { id, type, message }])
      const ttl = type === 'error' ? 6000 : type === 'pr' ? 7000 : 4000
      const timeout = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        timeouts.delete(timeout)
      }, ttl)
      timeouts.add(timeout)
    }
    window.addEventListener('app-toast', onToast)
    return () => {
      window.removeEventListener('app-toast', onToast)
      for (const timeout of timeouts) clearTimeout(timeout)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const { icon: Icon, classes } = STYLES[t.type]
        return (
          <button
            key={t.id}
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className={cn(
              'pointer-events-auto w-full flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-left text-sm font-bold animate-in slide-in-from-bottom-4 fade-in duration-300',
              classes
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="flex-1">{t.message}</span>
          </button>
        )
      })}
    </div>
  )
}
