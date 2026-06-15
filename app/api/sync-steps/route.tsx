import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const steps = searchParams.get('steps');
  const userId = searchParams.get('userId');
  const secretKey = searchParams.get('secretKey');

  if (secretKey !== "MON_MOT_DE_PASSE_SECRET_123") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // On tente une insertion simple
  const { data, error } = await supabase
    .from('seances_pas')
    .insert([
      {
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        pas: parseInt(steps || "0", 10)
      }
    ]);

  if (error) {
    console.error("Erreur Supabase:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
}