import { getAccessToken } from "@/lib/auth/session-storage";

import { supabase } from "@/integrations/supabase/client";

import type { StorageBucket } from "./buckets";



export class StorageAuthError extends Error {

  constructor(message = "Требуется авторизация для работы с файлами") {

    super(message);

    this.name = "StorageAuthError";

  }

}



function requireToken() {

  const token = getAccessToken();

  if (!token) throw new StorageAuthError();

  return token;

}



export async function uploadAuthenticatedFile(

  bucket: StorageBucket,

  path: string,

  file: File,

  options?: { upsert?: boolean },

) {

  requireToken();

  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {

    upsert: options?.upsert ?? false,

    contentType: file.type || undefined,

  });

  if (error) throw new Error(error.message);

  return data.path;

}



export async function removeAuthenticatedFiles(bucket: StorageBucket, paths: string[]) {

  requireToken();

  if (!paths.length) return;

  const { error } = await supabase.storage.from(bucket).remove(paths);

  if (error) throw new Error(error.message);

}



export function getPublicStorageUrl(bucket: StorageBucket, path: string) {

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  return data.publicUrl;

}



export async function listAuthenticatedFiles(bucket: StorageBucket, folder: string) {

  requireToken();

  const { data, error } = await supabase.storage.from(bucket).list(folder);

  if (error) throw new Error(error.message);

  return data ?? [];

}

