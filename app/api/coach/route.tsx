import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    if (!apiKey) return NextResponse.json({ error: "Clé API absente" }, { status: 500 });

    const { prompt } = await req.json();
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Le modèle officiel et rapide
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(`Tu es un expert powerlifting. Réponds UNIQUEMENT par un tableau JSON pur.
    Format attendu : [{"name": "Nom", "coachTracking": [{"reps": "3", "weight": "180", "rpe": "8"}], "comments": "IA"}]
    Demande utilisateur : ${prompt}`);

    const responseText = result.response.text();
    const cleanJson = responseText.substring(responseText.indexOf('['), responseText.lastIndexOf(']') + 1);
    
    const data = JSON.parse(cleanJson);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("ERREUR DÉTAILLÉE :", error.message);
    return NextResponse.json({ error: "Erreur IA" }, { status: 500 });
  }
}