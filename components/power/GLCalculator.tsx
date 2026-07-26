'use client';
import { useState } from 'react';
import { calculateIPFGL } from '@/lib/powerlifting';

export default function GLCalculator() {
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [bw, setBw] = useState<number | ''>('');
  const [total, setTotal] = useState<number | ''>('');

  const calculateGL = () => {
    if (!bw || !total || bw <= 0 || total <= 0) return '—';
    const score = calculateIPFGL(Number(total), Number(bw), gender);
    return score > 0 ? score.toFixed(2) : '—';
  };

  return (
    <div className="mt-6 p-6 sm:p-8 bg-zinc-950 border border-zinc-900 rounded-2xl">
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white uppercase tracking-widest">Calculateur IPF GL</h2>
        <p className="text-xs font-medium text-zinc-500 mt-2">Évalue ta force relative selon le standard international.</p>
      </div>
      
      <div className="space-y-6">
        {/* Choix de la catégorie - Sélecteur Minimaliste */}
        <div className="flex bg-zinc-900 p-1 rounded-xl">
          <button 
            onClick={() => setGender('male')}
            className={`flex-1 py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${gender === 'male' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-white'}`}
          >
            Homme
          </button>
          <button 
            onClick={() => setGender('female')}
            className={`flex-1 py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${gender === 'female' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-white'}`}
          >
            Femme
          </button>
        </div>

        {/* Champs de saisie - Mode "Pro App" */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Poids (kg)</label>
            <input 
              type="number" 
              inputMode="decimal"
              value={bw} 
              onChange={(e) => setBw(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-zinc-900 rounded-xl p-4 text-white text-xl font-bold text-center tabular-nums outline-none focus:ring-2 focus:ring-zinc-700 transition-all placeholder:text-zinc-700"
              placeholder="83"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Total (kg)</label>
            <input 
              type="number" 
              inputMode="decimal"
              value={total} 
              onChange={(e) => setTotal(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-zinc-900 rounded-xl p-4 text-white text-xl font-bold text-center tabular-nums outline-none focus:ring-2 focus:ring-zinc-700 transition-all placeholder:text-zinc-700"
              placeholder="500"
            />
          </div>
        </div>

        {/* Affichage du Résultat - Chiffres massifs */}
        <div className="mt-8 pt-8 border-t border-zinc-900/80 flex flex-col items-center justify-center">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Score GL</span>
          <span className="text-6xl font-black tabular-nums tracking-tighter text-white">
            {calculateGL()}
          </span>
        </div>
      </div>
    </div>
  );
}