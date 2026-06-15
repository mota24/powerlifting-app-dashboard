import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // On répond juste "OK" pour voir si l'iPhone reçoit quelque chose
  return new Response("TEST OK", { status: 200 });
}