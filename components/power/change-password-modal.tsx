'use client'

import { useState } from 'react'
import { KeyRound, Lock, RefreshCw, Check, X } from 'lucide-react'

interface Props {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmation) { setError('LA CONFIRMATION EST DIFFÉRENTE.'); return }
    setIsSubmitting(true); setError('')
    try {
      const res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }), })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(body?.error ?? `Erreur serveur (${res.status})`)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ERREUR INCONNUE')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = "w-full p-4 bg-black border border-zinc-800 rounded-xl text-white font-bold tracking-widest outline-none focus:border-white transition-colors"

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm p-8 rounded-2xl border border-zinc-900 bg-zinc-950 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors">
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-3 mb-8">
          <KeyRound className="size-5 text-white" />
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Sécurité</h2>
        </div>

        {success ? (
          <div className="space-y-6">
            <div className="p-5 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2">
              <Check className="size-4 shrink-0" /> MOT DE PASSE MIS À JOUR
            </div>
            <button onClick={onClose} className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-widest rounded-full transition-colors">
              FERMER
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-950/50 border border-red-900/50 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl text-center">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                <Lock className="size-3" /> Actuel
              </label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} autoComplete="current-password" required />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                <KeyRound className="size-3" /> Nouveau
              </label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} autoComplete="new-password" required />
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed mt-2">
                12 CARACTÈRES MIN. MAJ, MIN, CHIFFRE.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                <KeyRound className="size-3" /> Confirmation
              </label>
              <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputClass} autoComplete="new-password" required />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full py-4 mt-4 bg-white hover:bg-zinc-200 text-black text-[10px] font-black uppercase tracking-widest rounded-full transition-colors flex justify-center items-center gap-2 disabled:opacity-50">
              {isSubmitting ? <RefreshCw className="size-4 animate-spin" /> : 'METTRE À JOUR'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}