import axios from "axios";

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createGmailDraft(
  accessToken: string,
  input: { from: string; to: string; subject: string; body: string },
): Promise<void> {
  const mime = [`From: ${input.from}`, `To: ${input.to}`, `Subject: ${input.subject}`, "", input.body].join(
    "\n",
  );

  await axios.post(
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    { message: { raw: base64UrlEncode(mime) } },
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } },
  );
}
