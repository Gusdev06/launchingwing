import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { verifyAccessJwt } from "@/lib/access-jwt";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

// Fora do ChatGPT Sites, quem identifica o usuário é o Cloudflare Access: ele exige login por código
// no e-mail antes de a requisição chegar aqui e manda um JWT assinado. Com CF_ACCESS_TEAM_DOMAIN e
// CF_ACCESS_AUD definidos, só o JWT vale; os cabeçalhos do ChatGPT são ignorados.
type AccessConfig = { team: string; aud: string };
function accessConfig(): AccessConfig | null {
  const e = env as unknown as { CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string };
  return e.CF_ACCESS_TEAM_DOMAIN && e.CF_ACCESS_AUD ? { team: e.CF_ACCESS_TEAM_DOMAIN, aud: e.CF_ACCESS_AUD } : null;
}
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const access = accessConfig();
  if (access) {
    const token = requestHeaders.get("cf-access-jwt-assertion");
    if (!token) return null;
    try {
      return await verifyAccessJwt(token, access);
    } catch {
      return null;
    }
  }
  // Os cabeçalhos do ChatGPT só valem quando uma camada confiável os injeta (dev local ou o Sites).
  // Num Worker aberto na internet, qualquer um poderia mandá-los: por isso exigem ALLOW_CHATGPT_HEADERS=1.
  if ((env as unknown as { ALLOW_CHATGPT_HEADERS?: string }).ALLOW_CHATGPT_HEADERS !== "1") return null;
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId,
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  // Sem Access configurado e sem os cabeçalhos do ChatGPT, não há como entrar: volta para a landing.
  if (!accessConfig() && (env as unknown as { ALLOW_CHATGPT_HEADERS?: string }).ALLOW_CHATGPT_HEADERS !== "1") redirect("/");
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  // Com Access, a própria página protegida pede o e-mail e manda o código.
  if (accessConfig()) return safeReturnTo;
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  if (accessConfig()) return "/cdn-cgi/access/logout";
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
