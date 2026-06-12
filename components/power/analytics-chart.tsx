'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const data = [
  { day: 'S1', rpe: 7.2, fatigue: 4, sensations: 7 },
  { day: 'S2', rpe: 7.8, fatigue: 5, sensations: 6.5 },
  { day: 'S3', rpe: 8.1, fatigue: 6, sensations: 6 },
  { day: 'S4', rpe: 8.6, fatigue: 7.5, sensations: 5 },
  { day: 'S5', rpe: 9, fatigue: 8, sensations: 4.5 },
  { day: 'S6', rpe: 8.2, fatigue: 5.5, sensations: 7.5 },
  { day: 'S7', rpe: 7.5, fatigue: 4, sensations: 8.5 },
]

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-popover-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-popover-foreground">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="capitalize">{p.name}</span>
          <span className="ml-auto font-mono tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function AnalyticsChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="gRpe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="circle"
          />
          <Area
            type="monotone"
            dataKey="rpe"
            name="RPE moyen"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill="url(#gRpe)"
          />
          <Line
            type="monotone"
            dataKey="fatigue"
            name="Fatigue"
            stroke="var(--chart-4)"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="sensations"
            name="Sensations"
            stroke="var(--chart-3)"
            strokeWidth={2.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
