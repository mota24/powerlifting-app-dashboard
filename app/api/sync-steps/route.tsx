import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// LIGNE CRUCIALE : Interdit à Next.js de mettre cette route en cache
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const steps = searchParams.get('steps');
  const userId = searchParams.get('userId');
  const secretKey = searchParams.get('secretKey');

  if (secretKey !== "MON_MOT_DE_PASSE_SECRET_123") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // LIGNE CRUCIALE : Force la date au fuseau horaire français (Paris)
  // 'en-CA' génère nativement le format YYYY-MM-DD dont tu as besoin
  const dateFrancaise = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

  // On tente une insertion simple
  const { data, error } = await supabase
    .from('seances_pas')
    .insert([
      {
        user_id: userId,
        date: dateFrancaise,
        pas: parseInt(steps || "0", 10)
      }
    ]);

  if (error) {
    console.error("Erreur Supabase:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ 
    success: true, 
    date_enregistree: dateFrancaise,
    pas_enregistres: steps
  });
}