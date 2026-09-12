'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Flag, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModale } from '@/lib/use-modale'
import { useT } from '@/app/ThemeContext'
import type { CleTraduction } from '@/lib/i18n'
import { CONFIG_KEY, WORK_MAX, WORK_MIN, buildSequence, formatDuree, lireConfig, normalizeWorkTimes, type CircuitConfig, type Phase, type PhaseKind, type Status } from '@/lib/circuit'
import { Stepper } from '@/components/power/circuit-stepper'

// ————————————————————————————————————————————————
// Générateur de son (Web Audio API)
// ————————————————————————————————————————————————
let audioCtx: AudioContext | null = null;

// iOS ne débloque le son qu'à l'intérieur d'un geste utilisateur : appelé au démarrage du circuit.
const contexteAudio = (): AudioContext => {
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
};

const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
  if (typeof window === 'undefined') return;
  try {
    const ctx = contexteAudio();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch { }
};

// ————————————————————————————————————————————————
// Chronomètre de Circuit
// ————————————————————————————————————————————————

interface Props {
  onClose: () => void;
}

const vibrer = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined') navigator.vibrate?.(pattern)
}

// Couleurs professionnelles, brutes et saturées (style app élite)
const PHASE_META: Record<PhaseKind, { cle: CleTraduction; bg: string; text: string; urgentBg: string }> = {
  prep: { cle: 'phasePreparation', bg: 'bg-yellow-500', text: 'text-black', urgentBg: 'bg-yellow-400' },
  work: { cle: 'phaseTravail', bg: 'bg-zinc-950', text: 'text-white', urgentBg: 'bg-zinc-900' },
  rest: { cle: 'phaseRepos', bg: 'bg-white', text: 'text-black', urgentBg: 'bg-zinc-200' },
  longRest: { cle: 'phaseReposLong', bg: 'bg-zinc-800', text: 'text-white', urgentBg: 'bg-zinc-700' },
}

export default function CircuitTimer({ onClose }: Props) {
  const t = useT()
  const [config, setConfig] = useState<CircuitConfig>(lireConfig)
  const [phases, setPhases] = useState<Phase[]>([])
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

  useModale()

  const demarrer = () => {
    try { contexteAudio() } catch { }

    const seq = buildSequence(config)
    if (seq.length === 0) return
    phasesRef.current = seq
    setPhases(seq)
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

  const phase = phases[phaseIndex]
  const enCours = status === 'running' || status === 'paused'
  const secondes = Math.ceil(msRestants / 1000)
  const urgence = status === 'running' && secondes <= 3
  const meta = phase ? PHASE_META[phase.kind] : PHASE_META.prep

  const progression = enCours && phases.length > 0
    ? Math.round(((phaseIndex + 1 - msRestants / 1000 / (phase?.duration || 1)) / phases.length) * 100)
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
          {t('chronoTitre')}
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
            <Stepper label={t('preparation')} unit="s" value={config.prep} min={0} max={60} step={5} onChange={(v) => patchConfig({ prep: v })} />
            <Stepper label={t('exercices')} value={config.exercices} min={1} max={20} step={1} onChange={(v) => patchConfig({ exercices: v })} />

            <div className="space-y-2 py-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 pl-1">{t('dureesTravail')}</h3>
              {normalizeWorkTimes(config.workTimes, config.exercices).map((duree, i) => (
                <Stepper key={i} label={t('exerciceN', { n: i + 1 })} unit="s" value={duree} min={WORK_MIN} max={WORK_MAX} step={5} onChange={(v) => setWorkTime(i, v)} />
              ))}
            </div>

            <Stepper label={t('reposInterExercice')} unit="s" value={config.rest} min={0} max={3600} step={5} onChange={(v) => patchConfig({ rest: v })} />
            <Stepper label={t('tours')} value={config.tours} min={1} max={20} step={1} onChange={(v) => patchConfig({ tours: v })} />
            <Stepper label={t('reposInterTour')} unit="s" value={config.longRest} min={0} max={3600} step={5} onChange={(v) => patchConfig({ longRest: v })} />

            <div className="flex items-center justify-between py-6 px-2 mt-4 border-t border-zinc-900">
              <span className="text-sm font-medium text-zinc-400">{t('dureeTotale')}</span>
              <span className="text-xl font-bold text-white">{formatDuree(dureeTotale)}</span>
            </div>

            <button
              onClick={demarrer}
              className="w-full mt-4 p-5 rounded-full font-bold text-sm tracking-widest uppercase bg-white text-black hover:bg-zinc-200 transition-colors"
            >
              {t('demarrerCircuit')}
            </button>
          </div>
        </div>
      )}

      {/* ÉCRAN CHRONO */}
      {enCours && phase && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12 select-none">
          <div className={cn('text-sm font-bold uppercase tracking-[0.4em] mb-4', meta.text)}>
            {status === 'paused' ? t('pause') : t(meta.cle)}
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
            <span>{t('exerciceMot')} {phase.exercice}/{config.exercices}</span>
            <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
            <span>{t('tourMot')} {phase.tour}/{config.tours}</span>
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
          <div className="text-2xl font-bold tracking-widest uppercase text-white mb-2">{t('termine')}</div>
          <p className="text-zinc-500 font-medium mb-12">
            {t('toursDuree', { n: config.tours, duree: formatDuree(dureeTotale) })}
          </p>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button
              onClick={demarrer}
              className="w-full p-4 rounded-full font-bold text-sm tracking-widest uppercase bg-white text-black hover:bg-zinc-200 transition-colors"
            >
              {t('recommencer')}
            </button>
            <button
              onClick={reinitialiser}
              className="w-full p-4 rounded-full font-bold text-sm tracking-widest uppercase bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
            >
              {t('parametres')}
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
