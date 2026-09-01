const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

const normalizeApiBaseUrl = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Missing required frontend config: API_BASE_URL");
  }

  const normalized = trimTrailingSlashes(value.trim());

  if (normalized.startsWith("/")) {
    if (normalized.startsWith("//")) {
      throw new Error("Invalid API_BASE_URL. Protocol-relative URLs are not supported.");
    }
    return normalized;
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Invalid API_BASE_URL. Use a relative path starting with '/' or an absolute http(s) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid API_BASE_URL. Only http and https URLs are supported.");
  }

  if (url.username || url.password) {
    throw new Error("Invalid API_BASE_URL. Credentials must not be embedded in the URL.");
  }

  if (import.meta.env.MODE !== "development" && url.protocol !== "https:") {
    throw new Error("Invalid API_BASE_URL. Production builds must use https.");
  }

  return normalized;
};

export const env = {
  apiBaseUrl: normalizeApiBaseUrl(import.meta.env.API_BASE_URL),
} as const;
