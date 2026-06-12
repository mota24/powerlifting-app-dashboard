'use client'

import { Flame } from 'lucide-react'

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        
        {/* MODIFICATION ICI : Le <div> est devenu un lien <a> cliquable */}
        <a href="/" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
          <Flame className="size-6 text-blue-500 animate-pulse" />
          <h1 className="text-xl font-bold tracking-tight text-white">Mota Performance</h1>
        </a>

        <div className="text-xs text-slate-500 font-medium bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
          SBD Tracking Pro
        </div>
      </div>
    </header>
  )
}