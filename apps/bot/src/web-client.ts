const WEB_URL = `http://localhost:${process.env['WEB_PORT'] ?? 3000}`
const SECRET = process.env['BOT_INTERNAL_SECRET']!

export async function callWeb<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${WEB_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': SECRET,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Web error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}
