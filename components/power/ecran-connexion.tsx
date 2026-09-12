'use client'

import { useState } from 'react'
import { Lock, RefreshCw, User } from 'lucide-react'
import type { Traducteur } from '@/lib/i18n'
import type { AuthUser } from '@/lib/compte'

/**
 * Écran d'accès. Il s'affiche avant que le profil ne soit connu, donc hors du
 * ThemeProvider : son traducteur lui est passé par la page.
 */
export function EcranConnexion({ t, onConnecte }: { t: Traducteur; onConnecte: (user: AuthUser) => void }) {
  const [identifiant, setIdentifiant] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const seConnecter = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnvoi(true)
    setErreur('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiant, password }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? '')
      }
      const { user } = (await res.json()) as { user: AuthUser }
      setPassword('')
      onConnecte(user)
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : ''
      setErreur(message || "Identifiant ou mot de passe incorrect.")
    }
    setEnvoi(false)
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-foreground/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-sm p-8 rounded-2xl border border-border bg-card/80 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-secondary text-foreground rounded-full mb-4 ring-1 ring-border">
            <Lock className="size-8" />
          </div>
          <h1 className="text-2xl font-black text-foreground">{t('accesReserve')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('saisisIdentifiants')}</p>
        </div>

        <form onSubmit={seConnecter} className="space-y-5">
          {erreur && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold rounded-lg text-center">
              {erreur}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <User className="size-3" /> {t('identifiant')}
            </label>
            <input
              type="text"
              placeholder="Ex: 1"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              className="w-full p-3 bg-input border border-border rounded-lg text-foreground font-bold outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Lock className="size-3" /> {t('motDePasse')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-input border border-border rounded-lg text-foreground font-bold outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={envoi}
            className="w-full py-4 mt-4 bg-primary hover:opacity-90 text-primary-foreground font-black rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex justify-center items-center gap-2"
          >
            {envoi ? <RefreshCw className="size-5 animate-spin" /> : 'DÉVERROUILLER'}
          </button>
        </form>
      </div>
    </div>
  )
}
