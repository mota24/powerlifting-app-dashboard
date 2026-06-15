import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// On récupère la clé sécurisée depuis ton fichier .env.local
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json({ error: "Clé API manquante" }, { status: 500 });
    }

    const { prompt } = await req.json();

    // On configure Gemini avec le modèle rapide et on lui donne son "rôle" (System Prompt)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `Tu es un assistant expert en force athlétique (powerlifting) intégré à une application web.
Ton unique but est d'analyser la demande d'entraînement de l'utilisateur (ex: "3x3 squat à 180") et de la transformer en un format JSON strict.

RÈGLES ABSOLUES :
1. Tu ne dois renvoyer QUE du JSON valide, sans aucun autre texte, explication ou balises markdown (\`\`\`json).
2. Si l'utilisateur demande "3x3", tu dois générer 3 objets dans le tableau "coachTracking".
3. Laisse les champs weight ou rpe vides ("") si non précisés.

FORMAT ATTENDU :
[
  {
    "name": "Nom de l'exercice propre (ex: Back Squat, Bench Press, Deadlift)",
    "coachTracking": [
      { "reps": "3", "weight": "180", "rpe": "" },
      { "reps": "3", "weight": "180", "rpe": "" },
      { "reps": "3", "weight": "180", "rpe": "" }
    ],
    "comments": "Généré par Smart Coach"
  }
]`
    });

    // On envoie la demande
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // On nettoie la réponse au cas où l'IA ajouterait des balises Markdown
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return NextResponse.json(data);

  } catch (error) {
    console.error("Erreur Gemini:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du programme." }, { status: 500 });
  }
}