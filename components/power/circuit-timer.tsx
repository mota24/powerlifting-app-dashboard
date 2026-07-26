'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, X, RotateCcw, Minus, Plus, Flag, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

// ————————————————————————————————————————————————
// Générateur de son (Web Audio API)
// ————————————————————————————————————————————————
let audioCtx: AudioContext | null = null;

const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
  if (typeof window === 'undefined') return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.error("Audio error", e);
  }
};

// ————————————————————————————————————————————————
// Chronomètre de Circuit
// ————————————————————————————————————————————————

interface Props {
  onClose: () => void;
}

interface CircuitConfig {
  prep: number;
  exercices: number;
  workTimes: number[];
  rest: number;
  tours: number;
  longRest: number;
}

const WORK_MIN = 5
const WORK_MAX = 3600 
const DEFAULT_WORK = 40

const DEFAULT_CONFIG: CircuitConfig = { prep: 5, exercices: 3, workTimes: [40, 40, 40], rest: 15, tours: 3, longRest: 40 }
const CONFIG_KEY = 'circuit_timer_config'

function normalizeWorkTimes(workTimes: number[] | undefined, exercices: number): number[] {
  const source = Array.isArray(workTimes) ? workTimes : []
  const out = source.slice(0, exercices)
  while (out.length < exercices) {
    out.push(out.length > 0 ? out[out.length - 1] : DEFAULT_WORK)
  }
  return out
}

type PhaseKind = 'prep' | 'work' | 'rest' | 'longRest'

interface Phase {
  kind: PhaseKind;
  duration: number;
  exercice: number;
  tour: number;
}

type Status = 'config' | 'running' | 'paused' | 'finished'

function buildSequence(cfg: CircuitConfig): Phase[] {
  const phases: Phase[] = []
  const workTimes = normalizeWorkTimes(cfg.workTimes, cfg.exercices)
  if (cfg.prep > 0) phases.push({ kind: 'prep', duration: cfg.prep, exercice: 1, tour: 1 })
  for (let tour = 1; tour <= cfg.tours; tour++) {
    for (let ex = 1; ex <= cfg.exercices; ex++) {
      phases.push({ kind: 'work', duration: workTimes[ex - 1] ?? DEFAULT_WORK, exercice: ex, tour })
      if (ex < cfg.exercices && cfg.rest > 0) {
        phases.push({ kind: 'rest', duration: cfg.rest, exercice: ex + 1, tour })
      }
    }
    if (tour < cfg.tours && cfg.longRest > 0) {
      phases.push({ kind: 'longRest', duration: cfg.longRest, exercice: 1, tour: tour + 1 })
    }
  }
  return phases
}

function clampConfig(raw: Partial<CircuitConfig> & { work?: unknown }): Partial<CircuitConfig> {
  const clamp = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined
  const out: Partial<CircuitConfig> = {}
  const prep = clamp(raw.prep, 0, 60); if (prep !== undefined) out.prep = prep
  const exercices = clamp(raw.exercices, 1, 20); if (exercices !== undefined) out.exercices = exercices
  const rest = clamp(raw.rest, 0, 3600); if (rest !== undefined) out.rest = rest
  const tours = clamp(raw.tours, 1, 20); if (tours !== undefined) out.tours = tours
  const longRest = clamp(raw.longRest, 0, 3600); if (longRest !== undefined) out.longRest = longRest
  if (Array.isArray(raw.workTimes)) {
    const arr = raw.workTimes
      .map((w) => clamp(w, WORK_MIN, WORK_MAX))
      .filter((w): w is number => w !== undefined)
    if (arr.length > 0) out.workTimes = arr
  } else {
    const legacy = clamp(raw.work, WORK_MIN, WORK_MAX)
    if (legacy !== undefined) out.workTimes = [legacy]
  }
  return out
}

const vibrer = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined') navigator.vibrate?.(pattern)
}

const formatDuree = (totalSec: number) => {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}`
}

// Couleurs professionnelles, brutes et saturées (style app élite)
const PHASE_META: Record<PhaseKind, { label: string; bg: string; text: string; urgentBg: string }> = {
  prep: { label: 'PRÉPARATION', bg: 'bg-yellow-500', text: 'text-black', urgentBg: 'bg-yellow-400' },
  work: { label: 'TRAVAIL', bg: 'bg-zinc-950', text: 'text-white', urgentBg: 'bg-zinc-900' },
  rest: { label: 'REPOS', bg: 'bg-white', text: 'text-black', urgentBg: 'bg-zinc-200' },
  longRest: { label: 'REPOS LONG', bg: 'bg-zinc-800', text: 'text-white', urgentBg: 'bg-zinc-700' },
}

export default function CircuitTimer({ onClose }: Props) {
  const [config, setConfig] = useState<CircuitConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<Status>('config')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [msRestants, setMsRestants] = useState(0)
  
  const [isMuted, setIsMuted] = useState(false)
  const isMutedRef = useRef(isMuted)

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  const phasesRef = useRef<Phase[]>([])
  const phaseIdxRef = useRef(0)
  const finEtapeRef = useRef(0)
  const pauseResteRef = useRef(0)
  const lastBeepRef = useRef(-1)

  const persist = (cfg: CircuitConfig): CircuitConfig => {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) } catch { }
    return cfg
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONFIG_KEY)
      if (saved) {
        setConfig((prev) => {
          const merged = { ...prev, ...clampConfig(JSON.parse(saved)) }
          return { ...merged, workTimes: normalizeWorkTimes(merged.workTimes, merged.exercices) }
        })
      }
    } catch { }
  }, [])

  const patchConfig = (patch: Partial<CircuitConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      next.workTimes = normalizeWorkTimes(next.workTimes, next.exercices)
      return persist(next)
    })
  }

  const setWorkTime = (index: number, value: number) => {
    setConfig((prev) => {
      const workTimes = normalizeWorkTimes(prev.workTimes, prev.exercices)
      workTimes[index] = value
      return persist({ ...prev, workTimes })
    })
  }

  useEffect(() => {
    if (status !== 'running') return
    const tick = () => {
      const now = Date.now()
      let restant = finEtapeRef.current - now

      if (restant <= 0) {
        let idx = phaseIdxRef.current
        let fin = finEtapeRef.current
        let termine = false
        while (fin - now <= 0) {
          idx += 1
          if (idx >= phasesRef.current.length) { termine = true; break }
          fin += phasesRef.current[idx].duration * 1000
        }
        if (termine) {
          setStatus('finished')
          vibrer([300, 120, 300, 120, 500])
          if (!isMutedRef.current) playTone(500, 1, 'square')
          return
        }
        phaseIdxRef.current = idx
        finEtapeRef.current = fin
        setPhaseIndex(idx)
        lastBeepRef.current = -1
        
        vibrer(phasesRef.current[idx].kind === 'work' ? [120, 60, 120] : 180)
        if (!isMutedRef.current) playTone(1200, 0.4, 'square')
        
        restant = fin - now
      }

      setMsRestants(restant)

      const sec = Math.ceil(restant / 1000)
      if (sec <= 3 && sec >= 1 && sec !== lastBeepRef.current) {
        lastBeepRef.current = sec
        vibrer(60)
        if (!isMutedRef.current) playTone(800, 0.15)
      }
    }
    tick()
    const id = setInterval(tick, 150)
    return () => clearInterval(id)
  }, [status])

  useEffect(() => {
    if (status !== 'running' && status !== 'paused') return
    let sentinel: WakeLockSentinel | null = null
    let actif = true
    const demander = async () => {
      try {
        if ('wakeLock' in navigator) {
          sentinel = await navigator.wakeLock.request('screen')
        }
      } catch { }
    }
    demander()
    const onVisible = () => {
      if (actif && document.visibilityState === 'visible') demander()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      actif = false
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => { })
    }
  }, [status])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  const demarrer = () => {
    if (typeof window !== 'undefined') {
      if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    const seq = buildSequence(config)
    if (seq.length === 0) return
    phasesRef.current = seq
    phaseIdxRef.current = 0
    finEtapeRef.current = Date.now() + seq[0].duration * 1000
    lastBeepRef.current = -1
    setPhaseIndex(0)
    setMsRestants(seq[0].duration * 1000)
    setStatus('running')
    vibrer(120)
  }

  const mettreEnPause = () => {
    pauseResteRef.current = Math.max(0, finEtapeRef.current - Date.now())
    setStatus('paused')
  }

  const reprendre = () => {
    finEtapeRef.current = Date.now() + pauseResteRef.current
    lastBeepRef.current = -1
    setStatus('running')
  }

  const reinitialiser = () => setStatus('config')

  const dureeTotale = useMemo(
    () => buildSequence(config).reduce((sum, p) => sum + p.duration, 0),
    [config]
  )

  const phase = phasesRef.current[phaseIndex]
  const enCours = status === 'running' || status === 'paused'
  const secondes = Math.ceil(msRestants / 1000)
  const urgence = status === 'running' && secondes <= 3
  const meta = phase ? PHASE_META[phase.kind] : PHASE_META.prep

  const progression = enCours && phasesRef.current.length > 0
    ? Math.round(((phaseIndex + 1 - msRestants / 1000 / (phase?.duration || 1)) / phasesRef.current.length) * 100)
    : 0

  return (
    <div
      className={cn(
        'fixed inset-0 z-[95] flex flex-col transition-colors duration-200',
        status === 'config' ? 'bg-black' : (urgence ? meta.urgentBg : meta.bg),
        status === 'finished' && 'bg-black'
      )}
    >
      {/* Barre supérieure minimaliste */}
      <div className="flex items-center justify-between p-6">
        <h2 className={cn("text-sm font-semibold tracking-widest uppercase", enCours ? meta.text : "text-white")}>
          Timer
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              "transition-opacity hover:opacity-70",
              enCours ? meta.text : "text-white",
              isMuted && "opacity-40"
            )}
          >
            {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <button onClick={onClose} className={cn("transition-opacity hover:opacity-70", enCours ? meta.text : "text-white")}>
            <X className="size-6" />
          </button>
        </div>
      </div>

      {/* ÉCRAN CONFIGURATION */}
      {status === 'config' && (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="mx-auto w-full max-w-md space-y-2">
            <Stepper label="Préparation" unit="s" value={config.prep} min={0} max={60} step={5} onChange={(v) => patchConfig({ prep: v })} />
            <Stepper label="Exercices" value={config.exercices} min={1} max={20} step={1} onChange={(v) => patchConfig({ exercices: v })} />

            <div className="space-y-2 py-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 pl-1">Durées de travail</h3>
              {normalizeWorkTimes(config.workTimes, config.exercices).map((duree, i) => (
                <Stepper key={i} label={`Exercice ${i + 1}`} unit="s" value={duree} min={WORK_MIN} max={WORK_MAX} step={5} onChange={(v) => setWorkTime(i, v)} />
              ))}
            </div>

            <Stepper label="Repos (Inter-exercice)" unit="s" value={config.rest} min={0} max={3600} step={5} onChange={(v) => patchConfig({ rest: v })} />
            <Stepper label="Tours" value={config.tours} min={1} max={20} step={1} onChange={(v) => patchConfig({ tours: v })} />
            <Stepper label="Repos (Inter-tour)" unit="s" value={config.longRest} min={0} max={3600} step={5} onChange={(v) => patchConfig({ longRest: v })} />

            <div className="flex items-center justify-between py-6 px-2 mt-4 border-t border-zinc-900">
              <span className="text-sm font-medium text-zinc-400">Durée totale</span>
              <span className="text-xl font-bold text-white">{formatDuree(dureeTotale)}</span>
            </div>

            <button
              onClick={demarrer}
              className="w-full mt-4 p-5 rounded-full font-bold text-sm tracking-widest uppercase bg-white text-black hover:bg-zinc-200 transition-colors"
            >
              Démarrer le circuit
            </button>
          </div>
        </div>
      )}

      {/* ÉCRAN CHRONO */}
      {enCours && phase && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12 select-none">
          <div className={cn('text-sm font-bold uppercase tracking-[0.4em] mb-4', meta.text)}>
            {status === 'paused' ? 'PAUSE' : meta.label}
          </div>

          <div
            className={cn(
              'font-black tabular-nums leading-none text-[35vw] sm:text-[15rem] tracking-tighter',
              meta.text,
              status === 'paused' && 'opacity-30'
            )}
          >
            {formatDuree(secondes)}
          </div>

          <div className={cn("flex items-center gap-6 mt-8 text-sm font-medium tracking-wide", meta.text, "opacity-80")}>
            <span>Exercice {phase.exercice}/{config.exercices}</span>
            <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
            <span>Tour {phase.tour}/{config.tours}</span>
          </div>

          <div className="flex items-center gap-4 mt-16">
            <button
              onClick={status === 'paused' ? reprendre : mettreEnPause}
              className={cn(
                "h-16 w-16 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95",
                meta.text === 'text-black' ? 'bg-black text-white' : 'bg-white text-black'
              )}
            >
              {status === 'paused' ? <Play className="size-6 ml-1" /> : <Pause className="size-6" />}
            </button>
            <button
              onClick={reinitialiser}
              className={cn("h-16 w-16 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity", meta.text)}
            >
              <RotateCcw className="size-6" />
            </button>
          </div>
        </div>
      )}

      {/* ÉCRAN FIN DE CIRCUIT */}
      {status === 'finished' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 text-center bg-black">
          <Flag className="size-10 text-white mb-6" />
          <div className="text-2xl font-bold tracking-widest uppercase text-white mb-2">Terminé</div>
          <p className="text-zinc-500 font-medium mb-12">
            {config.tours} tours · {formatDuree(dureeTotale)}
          </p>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button
              onClick={demarrer}
              className="w-full p-4 rounded-full font-bold text-sm tracking-widest uppercase bg-white text-black hover:bg-zinc-200 transition-colors"
            >
              Recommencer
            </button>
            <button
              onClick={reinitialiser}
              className="w-full p-4 rounded-full font-bold text-sm tracking-widest uppercase bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
            >
              Paramètres
            </button>
          </div>
        </div>
      )}

      {/* Barre de progression globale slim */}
      {enCours && (
        <div className="absolute bottom-0 left-0 h-1 w-full bg-black/10">
          <div
            className={cn("h-full transition-all duration-300", meta.text === 'text-black' ? 'bg-black' : 'bg-white')}
            style={{ width: `${Math.min(100, Math.max(0, progression))}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ————————————————————————————————————————————————
// Stepper : Design Brutaliste/Minimaliste
// ————————————————————————————————————————————————
function Stepper({ label, value, onChange, min, max, step, unit }: {
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

  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toString());
    }
  }, [value, isEditing]);

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