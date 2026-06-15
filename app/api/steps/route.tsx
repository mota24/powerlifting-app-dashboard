export async function GET(request: Request) {
  return new Response("SERVEUR OK", {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}