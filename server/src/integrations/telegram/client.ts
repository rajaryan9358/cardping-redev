import axios from "axios";
import { env } from "../../config/env";
import { InlineButton } from "./types";

const api = axios.create({ baseURL: `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}` });
const fileApi = axios.create({ baseURL: `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}` });

async function sendMessage(
  chatId: string,
  text: string,
  opts: { replyToMessageId?: number; buttons?: InlineButton[]; buttonRows?: InlineButton[][] } = {},
): Promise<number> {
  const rows = opts.buttonRows ?? (opts.buttons ? [opts.buttons] : undefined);
  const { data } = await api.post("/sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(opts.replyToMessageId ? { reply_to_message_id: opts.replyToMessageId } : {}),
    ...(rows
      ? {
          reply_markup: {
            inline_keyboard: rows.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))),
          },
        }
      : {}),
  });
  return data.result.message_id as number;
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await api.post("/answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

async function getFilePath(fileId: string): Promise<string> {
  const { data } = await api.get("/getFile", { params: { file_id: fileId } });
  return data.result.file_path as string;
}

async function downloadFile(filePath: string): Promise<Buffer> {
  const { data } = await fileApi.get<ArrayBuffer>(`/${filePath}`, { responseType: "arraybuffer" });
  return Buffer.from(data);
}

async function downloadFileById(fileId: string): Promise<Buffer> {
  const filePath = await getFilePath(fileId);
  return downloadFile(filePath);
}

/** Registers (or clears) the webhook Telegram will POST updates to.
 * Run via `npm run register:telegram-webhook` — see scripts/. */
async function setWebhook(url: string, secretToken: string): Promise<void> {
  await api.post("/setWebhook", { url, secret_token: secretToken, allowed_updates: ["message", "callback_query"] });
}

async function deleteWebhook(): Promise<void> {
  await api.post("/deleteWebhook", {});
}

export const telegramClient = {
  sendMessage,
  answerCallbackQuery,
  getFilePath,
  downloadFile,
  downloadFileById,
  setWebhook,
  deleteWebhook,
};
