import 'server-only';

import { createHash } from 'node:crypto';
import type { UIMessage } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertDatabaseSuccess, createPrivilegedClient, SupabaseHttpError, throwMutationError } from '@/shared/api/supabase/http';
import { isStorageObjectConflict } from '@/shared/lib/storage-error';
import { chatFileReference, chatFileStoragePath, parseChatFileReference, validateChatFile, MAX_CHAT_FILE_BYTES, type ChatFileMime } from '../model/attachment';

const bucket = 'chat-message-files';
type StoredFile = { id: string; conversation_id: string; owner_id: string; storage_path: string; sha256: string; mime_type: ChatFileMime; byte_size: number; filename: string };

export async function requireChatFileOwner(client: SupabaseClient, conversationId: string, ownerId: string, active: boolean) {
  const result = await client.from('conversations').select('id,status').eq('id', conversationId).eq('owner_id', ownerId).neq('status', 'deleted').maybeSingle();
  assertDatabaseSuccess(result.error, 'chat_files.owner');
  if (!result.data) throw new SupabaseHttpError(404, 'CONVERSATION_NOT_FOUND', 'The conversation could not be found.');
  if (active && result.data.status !== 'active') throw new SupabaseHttpError(409, 'CONVERSATION_NOT_ACTIVE', 'Restore the conversation before uploading files.');
}

function decodeUpload(dataUrl: string) {
  const match = /^data:(image\/png|image\/jpeg|application\/pdf);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (!match) throw new SupabaseHttpError(415, 'CHAT_FILE_TYPE_INVALID', 'Use a PNG, JPEG or PDF file.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.toString('base64') !== match[2]) throw new SupabaseHttpError(400, 'CHAT_FILE_ENCODING_INVALID', 'The file encoding is invalid.');
  try { return { bytes, mimeType: validateChatFile(bytes, match[1]) }; }
  catch { throw new SupabaseHttpError(400, 'CHAT_FILE_INVALID', 'The file must match its PNG, JPEG or PDF type and be at most 2 MB.'); }
}

export async function storeChatFile(conversationId: string, ownerId: string, dataUrl: string, filename: string) {
  const admin = createPrivilegedClient();
  await requireChatFileOwner(admin, conversationId, ownerId, true);
  const { bytes, mimeType } = decodeUpload(dataUrl);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const path = chatFileStoragePath(ownerId, conversationId, digest, mimeType);
  const upload = await admin.storage.from(bucket).upload(path, bytes, { contentType: mimeType, upsert: false });
  if (upload.error && !isStorageObjectConflict(upload.error)) {
    throw new SupabaseHttpError(502, 'CHAT_FILE_UPLOAD_FAILED', 'The attachment could not be uploaded. Please retry.', true);
  }
  // Object keys are immutable and content-addressed. A retry registers the same
  // reference; do not delete an object another successful request may use.
  const result = await admin.rpc('register_chat_file', {
    _conversation_id: conversationId, _owner_id: ownerId, _sha256: digest,
    _mime_type: mimeType, _byte_size: bytes.length, _filename: filename,
  });
  if (result.error) throwMutationError(result.error, 'chat_files.register');
  const row = (Array.isArray(result.data) ? result.data.length === 1 ? result.data[0] : null : result.data) as StoredFile | null;
  if (!row?.id) throw new SupabaseHttpError(502, 'CHAT_FILE_REGISTER_FAILED', 'The attachment could not be registered. Please retry.', true);
  return { type: 'file' as const, url: chatFileReference(conversationId, row.id), mediaType: row.mime_type, filename: row.filename };
}

async function loadFileRecord(admin: SupabaseClient, conversationId: string, ownerId: string, attachmentId: string): Promise<StoredFile> {
  const result = await admin.from('chat_file_uploads').select('*').eq('id', attachmentId).eq('conversation_id', conversationId).eq('owner_id', ownerId).maybeSingle();
  assertDatabaseSuccess(result.error, 'chat_files.reference');
  const row = result.data as StoredFile | null;
  if (!row || row.storage_path !== chatFileStoragePath(ownerId, conversationId, row.sha256, row.mime_type)) throw new SupabaseHttpError(404, 'CHAT_FILE_NOT_FOUND', 'The attachment could not be found.');
  return row;
}

async function downloadFile(admin: SupabaseClient, row: StoredFile) {
  const downloaded = await admin.storage.from(bucket).download(row.storage_path);
  if (downloaded.error || !downloaded.data) throw new SupabaseHttpError(502, 'CHAT_FILE_DOWNLOAD_FAILED', 'The attachment could not be read. Please retry.', true);
  if (downloaded.data.size !== row.byte_size || downloaded.data.size > MAX_CHAT_FILE_BYTES) throw new SupabaseHttpError(502, 'CHAT_FILE_INTEGRITY_FAILED', 'The stored attachment failed validation.');
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new SupabaseHttpError(502, 'CHAT_FILE_INTEGRITY_FAILED', 'The stored attachment failed validation.');
  return bytes;
}

export async function readChatFile(conversationId: string, ownerId: string, attachmentId: string) {
  const admin = createPrivilegedClient();
  await requireChatFileOwner(admin, conversationId, ownerId, false);
  const row = await loadFileRecord(admin, conversationId, ownerId, attachmentId);
  return { row, bytes: await downloadFile(admin, row) };
}

export async function hydrateChatFiles(messages: UIMessage[], conversationId: string, ownerId: string): Promise<UIMessage[]> {
  const admin = createPrivilegedClient();
  await requireChatFileOwner(admin, conversationId, ownerId, true);
  const files = new Map<string, string>();
  let totalBytes = 0;
  const output: UIMessage[] = [];
  for (const message of messages) {
    const parts: UIMessage['parts'] = [];
    for (const part of message.parts) {
      if (part.type !== 'file') { parts.push(part); continue; }
      let reference;
      try { reference = parseChatFileReference(part.url); }
      catch { throw new SupabaseHttpError(400, 'CHAT_FILE_REFERENCE_REQUIRED', 'Reattach this file using the private upload flow.'); }
      if (reference.conversationId !== conversationId) throw new SupabaseHttpError(403, 'CHAT_FILE_SCOPE_MISMATCH', 'The attachment belongs to another conversation.');
      const row = await loadFileRecord(admin, conversationId, ownerId, reference.attachmentId);
      if (part.mediaType !== row.mime_type) throw new SupabaseHttpError(400, 'CHAT_FILE_TYPE_MISMATCH', 'The attachment type does not match the stored file.');
      // Count every occurrence in the provider payload, including cached files.
      totalBytes += row.byte_size;
      if (totalBytes > 16 * 1024 * 1024) throw new SupabaseHttpError(413, 'CHAT_FILES_CONTEXT_TOO_LARGE', 'Start a new conversation: this history contains more than 16 MB of files.');
      let dataUrl = files.get(part.url);
      if (!dataUrl) {
        const bytes = await downloadFile(admin, row);
        dataUrl = `data:${row.mime_type};base64,${Buffer.from(bytes).toString('base64')}`;
        files.set(part.url, dataUrl);
      }
      parts.push({ ...part, url: dataUrl });
    }
    output.push({ ...message, parts });
  }
  return output;
}
