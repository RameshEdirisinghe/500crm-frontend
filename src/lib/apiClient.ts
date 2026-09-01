import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const BASE_URL = "/api/v1";
export const AUTH_EXPIRED_EVENT = "crm-auth-expired";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<void> | null = null;
let authExpiredHandled = false;

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

const getPathname = (url?: string): string => {
  if (!url) return "";
  try {
    const base = BASE_URL.startsWith("http")
      ? BASE_URL
      : `${window.location.origin}${BASE_URL.startsWith("/") ? "" : "/"}${BASE_URL}`;
    return new URL(url, base).pathname;
  } catch {
    return url;
  }
};

const isAuthEndpoint = (url?: string) => {
  const pathname = getPathname(url);
  return (
    pathname.endsWith("/auth/login") ||
    pathname.endsWith("/auth/refresh") ||
    pathname.endsWith("/auth/logout")
  );
};

const notifyAuthExpired = () => {
  if (authExpiredHandled) return;
  authExpiredHandled = true;
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
};

export const markAuthRecovered = () => {
  authExpiredHandled = false;
};

const refreshSession = async (): Promise<void> => {
  await apiClient.post("/auth/refresh", undefined, { skipAuthRefresh: true });
  markAuthRecovered();
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshSession().finally(() => {
            refreshPromise = null;
          });
        }

        await refreshPromise;
        return apiClient(originalRequest);
      } catch (refreshError) {
        notifyAuthExpired();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
