'use client'

import { useState } from 'react'
import { KeyRound, Lock, RefreshCw, Check, X } from 'lucide-react'

interface Props {
  onClose: () => void;
}

/**
 * Changement de mot de passe. Le formulaire n'est qu'une façade : longueur,
 * complexité et contrôle des fuites (Have I Been Pwned) sont appliqués côté
 * serveur par /api/auth/change-password — impossibles à contourner d'ici.
 */
export default function ChangePasswordModal({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmation) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(body?.error ?? `Erreur serveur (${res.status})`)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    'w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold outline-none focus:border-blue-500 transition-colors'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fermer"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-full ring-1 ring-blue-500/20">
            <KeyRound className="size-5" />
          </div>
          <h2 className="text-lg font-black text-white">Changer le mot de passe</h2>
        </div>

        {success ? (
          <div className="space-y-5">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold rounded-lg flex items-center gap-2">
              <Check className="size-5 shrink-0" /> Mot de passe mis à jour !
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black rounded-xl transition-all"
            >
              FERMER
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Lock className="size-3" /> Mot de passe actuel
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="size-3" /> Nouveau mot de passe
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
                required
              />
              <p className="text-[11px] text-slate-500 leading-snug">
                12 caractères minimum, avec majuscule, minuscule et chiffre.
                Les mots de passe apparus dans des fuites de données sont refusés.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="size-3" /> Confirmation
              </label>
              <input
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 mt-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? <RefreshCw className="size-5 animate-spin" /> : 'METTRE À JOUR'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
