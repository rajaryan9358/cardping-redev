import axios from "axios";
import { env } from "../../config/env";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

/** Builds the URL we send the user to via WhatsApp/Telegram to connect
 * their Gmail account. `state` carries the internal user id back to us on
 * the callback (see routes/googleOAuth.route.ts). */
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SEND_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface TokenExchangeResult {
  refreshToken: string;
  accessToken: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenExchangeResult> {
  const { data } = await axios.post("https://oauth2.googleapis.com/token", null, {
    params: {
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
    },
  });
  return { refreshToken: data.refresh_token as string, accessToken: data.access_token as string };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { data } = await axios.post("https://oauth2.googleapis.com/token", null, {
    params: {
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
  });
  return data.access_token as string;
}

export async function getGmailAddress(accessToken: string): Promise<string> {
  const { data } = await axios.get("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data.emailAddress as string;
}
