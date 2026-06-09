export const PREVIEW_FETCH_TIMEOUT_MS = 30_000;
export const PREVIEW_RENDER_TIMEOUT_MS = 60_000;
export const PREVIEW_DEBOUNCE_MS = 400;

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
