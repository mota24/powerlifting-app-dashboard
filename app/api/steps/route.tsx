import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { secret, date, steps } = body

    // 1. SÉCURITÉ : Mot de passe pour éviter que n'importe qui modifie tes données
    if (secret !== 'MOTA_IPHONE_SECRET') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 401 })
    }

    // 2. Chercher si une séance existe déjà aujourd'hui
    const { data: existingData } = await supabase
      .from('workout_sets')
      .select('id')
      .eq('date', date)
      .order('created_at', { ascending: false })
      .limit(1)

    let result;
    if (existingData && existingData.length > 0) {
      // Si une séance existe, on met juste à jour les pas
      result = await supabase
        .from('workout_sets')
        .update({ steps_count: steps })
        .eq('id', existingData[0].id)
    } else {
      // Si c'est un jour de repos (aucune séance), on crée une ligne pour stocker les pas
      result = await supabase
        .from('workout_sets')
        .insert([{ 
          date: date,
          exercise_name: 'Jour de Repos',
          steps_count: steps,
          fatigue_score: 5,
          sleep_hours: 8
        }])
    }

    if (result.error) throw result.error

    return NextResponse.json({ success: true, steps })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}