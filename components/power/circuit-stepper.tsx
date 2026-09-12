'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

// ————————————————————————————————————————————————
// Stepper : Design Brutaliste/Minimaliste
// ————————————————————————————————————————————————
export function Stepper({ label, value, onChange, min, max, step, unit }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  const [inputValue, setInputValue] = useState(value.toString());
  const [isEditing, setIsEditing] = useState(false);

  const handleBlur = () => {
    setIsEditing(false);
    let str = inputValue.trim();
    let parsed = parseInt(str, 10);

    if (unit === 's') {
      if (str.includes(':')) {
        const parts = str.split(':');
        const m = parseInt(parts[0], 10) || 0;
        const s = parseInt(parts[1], 10) || 0;
        parsed = m * 60 + s;
      } else if (str.length >= 3 && str.endsWith('00')) {
        const m = parseInt(str.slice(0, -2), 10);
        parsed = m * 60;
      }
    }

    if (isNaN(parsed)) {
      setInputValue(value.toString());
      return;
    }

    const clamped = Math.max(min, Math.min(max, parsed));
    onChange(clamped);
    setInputValue(clamped.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
      <span className="text-sm font-medium text-zinc-300 ml-1">{label}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          className="h-10 w-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 transition-all"
        >
          <Minus className="size-4" />
        </button>

        <div className="relative flex items-center justify-center w-16">
          <input
            type="text"
            inputMode={unit === 's' ? 'decimal' : 'numeric'}
            value={isEditing ? inputValue : value}
            onFocus={(e) => {
              setInputValue(value.toString());
              setIsEditing(true);
              e.target.select();
            }}
            onBlur={handleBlur}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "w-full bg-transparent text-center text-lg font-bold text-white tabular-nums outline-none rounded-lg py-1 transition-all",
              isEditing && "bg-black/50"
            )}
          />
        </div>

        <button
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          className="h-10 w-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 transition-all"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}
