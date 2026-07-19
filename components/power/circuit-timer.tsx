'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Timer, Play, Pause, X, RotateCcw, Minus, Plus, Flag, Dumbbell, Coffee, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

// ————————————————————————————————————————————————
// Générateur de son (Web Audio API)
// Permet de faire des bips sans avoir besoin de fichiers MP3
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

    // Enveloppe sonore pour un son clair sans "clic" désagréable
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
const WORK_MAX = 10000000000000000000 // Augmenté pour permettre de taper 15:00 (900 sec)
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
  const rest = clamp(raw.rest, 0, 300); if (rest !== undefined) out.rest = rest
  const tours = clamp(raw.tours, 1, 20); if (tours !== undefined) out.tours = tours
  const longRest = clamp(raw.longRest, 0, 600); if (longRest !== undefined) out.longRest = longRest
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

const PHASE_META: Record<PhaseKind, { label: string; calme: string; urgent: string; accent: string }> = {
  prep: { label: 'PRÉPARATION', calme: 'bg-blue-950', urgent: 'bg-blue-800', accent: 'text-blue-300' },
  work: { label: 'TRAVAIL', calme: 'bg-emerald-950', urgent: 'bg-emerald-700', accent: 'text-emerald-300' },
  rest: { label: 'REPOS', calme: 'bg-rose-950', urgent: 'bg-rose-800', accent: 'text-rose-300' },
  longRest: { label: 'REPOS LONG', calme: 'bg-slate-900', urgent: 'bg-slate-700', accent: 'text-slate-300' },
}

export default function CircuitTimer({ onClose }: Props) {
  const [config, setConfig] = useState<CircuitConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<Status>('config')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [msRestants, setMsRestants] = useState(0)
  
  // État du son
  const [isMuted, setIsMuted] = useState(false)
  const isMutedRef = useRef(isMuted)

  // Met à jour la ref du son pour qu'elle soit accessible dans le setInterval
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

  // Moteur d'horloge
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
          // Bip grave et long pour la fin du circuit
          if (!isMutedRef.current) playTone(500, 1, 'square')
          return
        }
        phaseIdxRef.current = idx
        finEtapeRef.current = fin
        setPhaseIndex(idx)
        lastBeepRef.current = -1
        
        vibrer(phasesRef.current[idx].kind === 'work' ? [120, 60, 120] : 180)
        // Bip fort et aigu pour annoncer le début de la nouvelle phase
        if (!isMutedRef.current) playTone(1200, 0.4, 'square')
        
        restant = fin - now
      }

      setMsRestants(restant)

      const sec = Math.ceil(restant / 1000)
      if (sec <= 3 && sec >= 1 && sec !== lastBeepRef.current) {
        lastBeepRef.current = sec
        vibrer(60)
        // Bips des 3 dernières secondes
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
    demarrer()
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
    // Initialise le contexte audio au moment du clic utilisateur (requis par les navigateurs)
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
        'fixed inset-0 z-[95] flex flex-col transition-colors duration-500',
        status === 'config' && 'bg-slate-950',
        status === 'finished' && 'bg-emerald-950',
        enCours && (urgence ? meta.urgent : meta.calme)
      )}
    >
      {/* Barre supérieure */}
      <div className="flex items-center justify-between p-4">
        <h2 className="flex items-center gap-2 text-lg font-black text-white">
          <Timer className="size-5" /> Chrono Circuit
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? "Activer le son" : "Désactiver le son"}
            className={cn(
              "h-11 w-11 flex items-center justify-center rounded-xl transition-colors",
              isMuted ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/40" : "bg-black/20 text-emerald-400 hover:bg-black/40"
            )}
          >
            {isMuted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
          </button>

          <button
            onClick={onClose}
            title="Quitter"
            className="h-11 w-11 flex items-center justify-center rounded-xl bg-black/20 text-slate-300 hover:text-white hover:bg-black/40 transition-colors"
          >
            <X className="size-6" />
          </button>
        </div>
      </div>

      {/* ÉCRAN CONFIGURATION */}
      {status === 'config' && (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="mx-auto w-full max-w-md space-y-3">
            <Stepper label="Temps de préparation" unit="s" value={config.prep} min={0} max={60} step={5} onChange={(v) => patchConfig({ prep: v })} />
            <Stepper label="Exercices par tour" value={config.exercices} min={1} max={20} step={1} onChange={(v) => patchConfig({ exercices: v })} />

            <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Durée de travail par exercice</h3>
              {normalizeWorkTimes(config.workTimes, config.exercices).map((duree, i) => (
                <Stepper key={i} label={`Durée Exo ${i + 1}`} unit="s" value={duree} min={WORK_MIN} max={WORK_MAX} step={5} onChange={(v) => setWorkTime(i, v)} />
              ))}
            </div>

            <Stepper label="Repos entre exercices" unit="s" value={config.rest} min={0} max={300} step={5} onChange={(v) => patchConfig({ rest: v })} />
            <Stepper label="Nombre de tours" value={config.tours} min={1} max={20} step={1} onChange={(v) => patchConfig({ tours: v })} />
            <Stepper label="Repos entre les tours" unit="s" value={config.longRest} min={0} max={600} step={5} onChange={(v) => patchConfig({ longRest: v })} />

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60 text-sm">
              <span className="font-bold text-slate-400">Durée totale du circuit</span>
              <span className="text-lg font-black text-white tabular-nums">{formatDuree(dureeTotale)} min</span>
            </div>

            <button
              onClick={demarrer}
              className="w-full mt-2 p-5 rounded-2xl font-black text-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all flex items-center justify-center gap-3"
            >
              <Play className="size-7" /> DÉMARRER
            </button>
          </div>
        </div>
      )}

      {/* ÉCRAN CHRONO */}
      {enCours && phase && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 select-none">
          <div className={cn('text-2xl sm:text-3xl font-black tracking-[0.3em] mb-2', meta.accent)}>
            {status === 'paused' ? 'PAUSE' : meta.label}
          </div>

          <div
            className={cn(
              'font-black text-white tabular-nums leading-none text-[38vw] sm:text-[13rem]',
              status === 'paused' && 'opacity-40',
              urgence && 'animate-pulse'
            )}
          >
            {formatDuree(secondes)}
          </div>

          <div className="flex items-center gap-3 mt-4 text-white/90">
            <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/25 text-sm font-black">
              <Dumbbell className="size-4" />
              {phase.kind === 'rest' || phase.kind === 'longRest' ? 'Prochain : ' : ''}Exercice {phase.exercice}/{config.exercices}
            </span>
            <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/25 text-sm font-black">
              <Flag className="size-4" /> Tour {phase.tour}/{config.tours}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-10 w-full max-w-sm">
            <button
              onClick={status === 'paused' ? reprendre : mettreEnPause}
              className="flex-1 p-5 rounded-2xl font-black text-lg bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm transition-colors flex items-center justify-center gap-2"
            >
              {status === 'paused' ? <><Play className="size-6" /> REPRENDRE</> : <><Pause className="size-6" /> PAUSE</>}
            </button>
            <button
              onClick={reinitialiser}
              title="Réinitialiser"
              className="p-5 rounded-2xl bg-black/25 hover:bg-black/40 text-slate-200 transition-colors"
            >
              <RotateCcw className="size-6" />
            </button>
          </div>
        </div>
      )}

      {/* ÉCRAN FIN DE CIRCUIT */}
      {status === 'finished' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 text-center">
          <div className="p-5 bg-emerald-500/20 text-emerald-300 rounded-full mb-6 ring-1 ring-emerald-500/30">
            <Flag className="size-12" />
          </div>
          <div className="text-4xl font-black text-white mb-2">CIRCUIT TERMINÉ</div>
          <p className="text-emerald-300/80 font-bold mb-10">
            {config.tours} tour{config.tours > 1 ? 's' : ''} · {config.exercices} exercice{config.exercices > 1 ? 's' : ''} · {formatDuree(dureeTotale)} min d'intervalle
          </p>
          <div className="flex items-center gap-3 w-full max-w-sm">
            <button
              onClick={demarrer}
              className="flex-1 p-5 rounded-2xl font-black text-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="size-6" /> RECOMMENCER
            </button>
            <button
              onClick={reinitialiser}
              className="flex-1 p-5 rounded-2xl font-black text-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center gap-2"
            >
              <Coffee className="size-6" /> RÉGLAGES
            </button>
          </div>
        </div>
      )}

      {/* Barre de progression globale */}
      {enCours && (
        <div className="h-1.5 w-full bg-black/30">
          <div
            className="h-full bg-white/70 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progression))}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ————————————————————————————————————————————————
// Stepper : réglage hybride +/- et clavier
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
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60">
      <span className="text-sm font-bold text-slate-300">{label}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          className="h-11 w-11 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 transition-colors"
        >
          <Minus className="size-5" />
        </button>

        <div className="relative flex items-center justify-center w-20">
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
              "w-full bg-transparent text-center text-xl font-black text-white tabular-nums outline-none rounded-md py-1 transition-all",
              isEditing && "bg-black/30 ring-2 ring-emerald-500/50"
            )}
          />
          {unit && !isEditing && (
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
              {unit}
            </span>
          )}
        </div>

        <button
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          className="h-11 w-11 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 transition-colors"
        >
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  )
}