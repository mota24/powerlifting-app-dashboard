'use client'

import { useEffect, useState } from 'react'
import { Check, AlertTriangle, Info, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info' | 'pr'
export interface ToastAction { label: string; onClick: () => void }
interface ToastOptions { action?: ToastAction; dureeMs?: number }
interface ToastItem { id: number; type: ToastType; message: string; action?: ToastAction }

export function toast(message: string, type: ToastType = 'info', options: ToastOptions = {}) {
  if (typeof window === 'undefined') return
  window.setTimeout(() => { window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type, ...options } })) }, 0)
}

const STYLES: Record<ToastType, { icon: typeof Check; classes: string }> = {
  success: { icon: Check, classes: 'text-white border-zinc-800' },
  error: { icon: AlertTriangle, classes: 'text-white border-red-900/50' },
  info: { icon: Info, classes: 'text-white border-zinc-800' },
  pr: { icon: Trophy, classes: 'text-black bg-white border-white' }, // Le PR s'affiche en blanc pur pour contraster
}

let nextId = 1

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const timeouts = new Set<ReturnType<typeof setTimeout>>()
    const onToast = (e: Event) => {
      const { message, type, action, dureeMs } = (e as CustomEvent<{ message: string; type: ToastType } & ToastOptions>).detail
      const id = nextId++
      setToasts((prev) => [...prev.slice(-2), { id, type, message, action }])
      const ttl = dureeMs ?? (type === 'error' ? 6000 : type === 'pr' ? 7000 : 4000)
      const timeout = setTimeout(() => { setToasts((prev) => prev.filter((t) => t.id !== id)); timeouts.delete(timeout) }, ttl)
      timeouts.add(timeout)
    }
    window.addEventListener('app-toast', onToast)
    return () => { window.removeEventListener('app-toast', onToast); for (const timeout of timeouts) clearTimeout(timeout) }
  }, [])

  if (toasts.length === 0) return null

  const fermer = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id))

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center gap-3 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const { icon: Icon, classes } = STYLES[t.type]
        // Conteneur non cliquable : une notification porteuse d'une action
        // contient un bouton, qu'on ne peut pas imbriquer dans un autre bouton.
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto w-full flex items-center gap-4 px-5 py-4 rounded-xl border shadow-2xl backdrop-blur-md text-left text-xs font-bold uppercase tracking-wider animate-in slide-in-from-bottom-4 fade-in duration-300',
              t.type === 'pr' ? classes : `bg-black/95 ${classes}`
            )}
          >
            <button onClick={() => fermer(t.id)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
              <Icon className="size-5 shrink-0" />
              <span className="flex-1">{t.message}</span>
            </button>
            {t.action && (
              <button
                onClick={() => { t.action?.onClick(); fermer(t.id) }}
                className="shrink-0 rounded-lg border border-current px-3 py-1.5 text-[10px] font-black uppercase tracking-widest"
              >
                {t.action.label}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
