import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const steps = searchParams.get('steps');
  const userId = searchParams.get('userId');
  const secretKey = searchParams.get('secretKey');

  // Sécurité
  if (secretKey !== "MON_MOT_DE_PASSE_SECRET_123") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Envoi vers Supabase
  const { error } = await supabase
    .from('seances_pas')
    .upsert({
      user_id: userId,
      date: new Date().toISOString().split('T')[0],
      pas: parseInt(steps || "0", 10)
    }, { onConflict: 'user_id,date' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}