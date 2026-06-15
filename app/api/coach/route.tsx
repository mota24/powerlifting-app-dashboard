import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json({ error: "Clé API absente" }, { status: 500 });
    }

    const { prompt } = await req.json();
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.0-pro', // Change 'gemini-1.5-flash' par ceci
      systemInstruction: `Tu es un expert powerlifting. Réponds UNIQUEMENT avec un tableau JSON, rien d'autre...`
    });

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // Nettoyage agressif : on cherche le premier [ et le dernier ]
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    const jsonString = text.substring(start, end + 1);

    const data = JSON.parse(jsonString);
    return NextResponse.json(data);

  } catch (error) {
    console.error("ERREUR IA:", error);
    return NextResponse.json({ error: "Erreur de parsing IA" }, { status: 500 });
  }
}