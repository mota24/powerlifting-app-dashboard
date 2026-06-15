// Fichier : app/api/sync-steps/route.ts
import { NextResponse } from 'next/server';

import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
  try {
    // 1. On lit les données secrètes envoyées par l'iPhone
    const body = await req.json();
    const { steps, userId, secretKey } = body;

    // 2. Sécurité de base : on empêche n'importe qui de poster des pas
    if (secretKey !== "MON_MOT_DE_PASSE_SECRET_123") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    if (!steps || !userId) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    // 3. Calcul de la date locale (ex: "2026-06-15")
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISODate = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];

    // 4. Sauvegarde dans ta table Supabase (remplace 'seances' par le nom de ta table)
    const { error } = await supabase
      .from('seances')
      .upsert({
        user_id: userId,
        date: localISODate,
        steps: parseInt(steps, 10)
      }, { onConflict: 'user_id,date' });

    if (error) throw error;

    return NextResponse.json({ success: true, message: `Pas (${steps}) enregistrés pour le ${localISODate}` });

  } catch (error: any) {
    console.error("Erreur API Sync Steps :", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}