'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

const data = [
  { name: 'S1', Squat: 290, Bench: 165, Deadlift: 330 },
  { name: 'S2', Squat: 295, Bench: 167.5, Deadlift: 335 },
  { name: 'S3', Squat: 292.5, Bench: 170, Deadlift: 332.5 },
  { name: 'S4', Squat: 297.5, Bench: 170, Deadlift: 340 },
  { name: 'S5', Squat: 300, Bench: 172.5, Deadlift: 342.5 },
  { name: 'S6', Squat: 302.5, Bench: 175, Deadlift: 345 },
  { name: 'S7', Squat: 305, Bench: 178, Deadlift: 345 },
]

// 1. NOTRE LÉGENDE FIXE (Bas de l'écran)
const renderCustomLegend = () => {
  return (
    <div className="flex justify-center gap-6 pt-5 text-xs font-medium text-slate-300">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]"></span>
        Squat
      </div>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]"></span>
        Bench
      </div>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]"></span>
        Deadlift
      </div>
    </div>
  )
}

// 2. LE DICTATEUR DU TOOLTIP (La boîte noire au survol)
// Il attribue une valeur numérique pour forcer l'ordre d'affichage.
const orderMapping = { Squat: 1, Bench: 2, Deadlift: 3 }
const customTooltipSorter = (item: any) => {
  return orderMapping[item.name as keyof typeof orderMapping]
}

export function AnalyticsChart() {
  return (
    <div className="h-[350px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          
          <XAxis
            dataKey="name"
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 10', 'auto']}
          />
          
          {/* On injecte notre trieur ici (itemSorter) */}
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
            itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
            cursor={{ stroke: '#334155', strokeWidth: 2 }}
            itemSorter={customTooltipSorter}
          />
          
          <Legend content={renderCustomLegend} />
          
          <Line
            type="monotone"
            name="Squat"
            dataKey="Squat"
            stroke="#ef4444"
            strokeWidth={3}
            dot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            name="Bench"
            dataKey="Bench"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            name="Deadlift"
            dataKey="Deadlift"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}