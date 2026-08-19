import axios from "axios";
import { env } from "../../config/env";

// Separate from integrations/gmail/oauth.ts's scope/redirect (the unrelated
// Gmail follow-up-draft feature) — same Google Cloud OAuth client, a
// distinct "Authorized redirect URI" and a plain identity scope, since this
// is "log in with Google," not "let this bot draft emails on my behalf."
const DASHBOARD_LOGIN_SCOPE = "openid email profile";

export function buildDashboardGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_DASHBOARD_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: DASHBOARD_LOGIN_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const { data: tokenData } = await axios.post("https://oauth2.googleapis.com/token", null, {
    params: {
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_DASHBOARD_OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
    },
  });

  const { data: profile } = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  return {
    googleId: profile.id as string,
    email: profile.email as string,
    fullName: (profile.name as string) ?? null,
    avatarUrl: (profile.picture as string) ?? null,
  };
}
