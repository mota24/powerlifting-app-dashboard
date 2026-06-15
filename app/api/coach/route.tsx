import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    if (!apiKey) {
      return NextResponse.json({ error: "Clé API introuvable" }, { status: 500 });
    }

    // On interroge directement l'URL de Google pour lister TES modèles
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    // On affiche le résultat complet et brut dans la console Vercel
    console.error("====== DIAGNOSTIC : LISTE DES MODÈLES ======");
    console.error(JSON.stringify(data, null, 2));
    console.error("===========================================");

    return NextResponse.json({ 
      error: "Regarde les logs Vercel pour voir tes modèles autorisés",
      details: data 
    }, { status: 500 });

  } catch (error: any) {
    console.error("Erreur fatale de diagnostic :", error.message);
    return NextResponse.json({ error: "Échec du diagnostic" }, { status: 500 });
  }
}