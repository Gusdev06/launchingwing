// Verificação do JWT do Cloudflare Access (RS256), sem dependência. Puro: dá para provar em Node.
export type AccessUser = { userId: string; email: string; fullName: string | null; displayName: string };
export type AccessConfig = { team: string; aud: string };
type Jwk = JsonWebKey & { kid?: string };
let jwksCache: { at: number; keys: Jwk[] } | null = null;
async function accessKeys(team: string): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < 3600000) return jwksCache.keys;
  const response = await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Access certs unavailable");
  const { keys } = (await response.json()) as { keys: Jwk[] };
  jwksCache = { at: Date.now(), keys };
  return keys;
}
function b64url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const bytes = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i);
  return out;
}
export async function verifyAccessJwt(token: string, config: AccessConfig, keysFor: (team: string) => Promise<Jwk[]> = accessKeys): Promise<AccessUser | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header: { kid?: string; alg?: string }, payload: { sub?: string; email?: string; aud?: string | string[]; exp?: number; iss?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(b64url(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64url(parts[1])));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !payload.sub || !payload.email || !payload.exp) return null;
  if (payload.exp * 1000 < Date.now()) return null;
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(config.aud)) return null;
  if (payload.iss !== `https://${config.team}.cloudflareaccess.com`) return null;
  const jwk = (await keysFor(config.team)).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) return null;
  return { userId: payload.sub, email: payload.email, fullName: null, displayName: payload.email };
}

