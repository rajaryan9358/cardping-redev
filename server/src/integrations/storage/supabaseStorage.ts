import { supabase } from "../../db/client";
import { env } from "../../config/env";

function timestampSlug(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
}

async function uploadCardImage(userId: string, imageId: string, buffer: Buffer): Promise<{ path: string; publicUrl: string }> {
  const path = `${userId}/${imageId}_${timestampSlug()}.jpg`;
  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET_CARDS)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;

  const { data } = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET_CARDS).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

async function uploadVoiceNote(userId: string, cardId: string, buffer: Buffer): Promise<{ path: string; publicUrl: string }> {
  const path = `${userId}/${cardId}_${timestampSlug()}.ogg`;
  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET_VOICE)
    .upload(path, buffer, { contentType: "audio/ogg", upsert: true });
  if (error) throw error;

  const { data } = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET_VOICE).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

async function uploadEventThumbnail(eventId: string, buffer: Buffer, contentType: string): Promise<{ path: string; publicUrl: string }> {
  const ext = contentType === "image/png" ? "png" : "jpg";
  const path = `${eventId}/${timestampSlug()}.${ext}`;
  const { error } = await supabase.storage
    .from("event-thumbnails")
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;

  const { data } = await supabase.storage.from("event-thumbnails").getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export const supabaseStorage = { uploadCardImage, uploadVoiceNote, uploadEventThumbnail };
