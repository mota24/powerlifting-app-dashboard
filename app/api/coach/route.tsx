import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Vérification de la clé au démarrage
const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json({ error: "Clé API absente dans Vercel" }, { status: 500 });
    }

    const { prompt } = await req.json();
    
    // Initialisation du client
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // On utilise le modèle flash qui est le plus rapide et accessible
    const model = genAI.getGenerativeModel({
      model: 'gemini-pro'
    });

    const systemInstruction = `Tu es un expert en Powerlifting. 
    Transforme la demande de l'utilisateur en format JSON strict.
    Ne renvoie AUCUN texte, aucune explication, aucune balise markdown.
    Format attendu :
    [
      {
        "name": "Nom de l'exercice",
        "coachTracking": [
          { "reps": "3", "weight": "180", "rpe": "8" }
        ],
        "comments": "Généré par IA"
      }
    ]`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\nDemande utilisateur : ${prompt}` }] }]
    });

    const responseText = result.response.text();
    
    // Nettoyage robuste pour ne garder que le JSON
    const jsonMatch = responseText.match(/\[.*\]/s);
    if (!jsonMatch) {
      throw new Error("L'IA n'a pas renvoyé de JSON valide");
    }

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("ERREUR DÉTAILLÉE :", error.message);
    return NextResponse.json({ error: "Erreur de génération : " + error.message }, { status: 500 });
  }
}