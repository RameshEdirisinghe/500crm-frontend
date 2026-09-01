import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { env } from "../config/env";

export const AUTH_EXPIRED_EVENT = "crm-auth-expired";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
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
    const base = env.apiBaseUrl.startsWith("http")
      ? env.apiBaseUrl
      : `${window.location.origin}${env.apiBaseUrl.startsWith("/") ? "" : "/"}${env.apiBaseUrl}`;
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

const logAuthNetworkDiagnostic = (error: AxiosError, context: string) => {
  if (import.meta.env.PROD) return;

  const url = error.config?.url;
  const status = error.response?.status;
  const category =
    !error.response && error.request
      ? "NETWORK_ERROR"
      : status === 401
        ? "UNAUTHORIZED"
        : status === 403
          ? "FORBIDDEN"
          : "API_ERROR";

  console.debug("[auth]", {
    category,
    context,
    status,
    url,
    baseURL: error.config?.baseURL,
    message: error.message,
  });
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
        if (axios.isAxiosError(refreshError)) {
          logAuthNetworkDiagnostic(refreshError, "refresh");
        }
        notifyAuthExpired();
        return Promise.reject(refreshError);
      }
    }

    if (isAuthEndpoint(originalRequest.url) || error.response?.status === 401) {
      logAuthNetworkDiagnostic(error, "response");
    }

    return Promise.reject(error);
  },
);

export default apiClient;
