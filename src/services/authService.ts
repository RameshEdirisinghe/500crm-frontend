import axios from "axios";
import apiClient, { markAuthRecovered } from "../lib/apiClient";
import { User } from "../models/domain";

interface LoginResponse {
  data: {
    user: User;
  };
}

interface RefreshResponse {
  data: {
    user: User;
  };
}

export class SessionCookieNotEstablishedError extends Error {
  constructor(cause: unknown) {
    super(
      "Login succeeded, but the browser did not establish the session cookie.",
    );
    this.name = "SessionCookieNotEstablishedError";
    this.cause = cause;
  }
}

export class AuthService {
  /**
   * Login with username/email + password.
   * Backend stores access and refresh tokens as HttpOnly cookies.
   */
  static async login(emailOrUsername: string, password: string): Promise<User> {
    await apiClient.post<LoginResponse>(
      "/auth/login",
      {
        emailOrUsername: emailOrUsername.trim(),
        password,
      },
      { skipAuthRefresh: true },
    );

    let user: User;
    try {
      user = await this.getCurrentUser();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        if (import.meta.env.DEV) {
          console.debug("[auth]", {
            category: "SESSION_COOKIE_NOT_ESTABLISHED",
            loginStatus: 200,
            meStatus: 401,
            apiBaseUrl: apiClient.defaults.baseURL,
          });
        }
        throw new SessionCookieNotEstablishedError(error);
      }
      throw error;
    }

    markAuthRecovered();
    return user;
  }

  /**
   * Refresh the cookie-backed session.
   */
  static async refresh(): Promise<User> {
    const response = await apiClient.post<RefreshResponse>(
      "/auth/refresh",
      undefined,
      { skipAuthRefresh: true },
    );
    markAuthRecovered();
    return response.data.data.user;
  }

  /**
   * Restore cookie-backed auth on page load.
   */
  static async restoreSession(): Promise<User | null> {
    try {
      return await this.getCurrentUser();
    } catch {
      try {
        await this.refresh();
        return await this.getCurrentUser();
      } catch {
        return null;
      }
    }
  }

  /**
   * Logout: revoke server session and clear auth cookies.
   */
  static async logout(): Promise<void> {
    await apiClient.post("/auth/logout", undefined, { skipAuthRefresh: true });
  }

  /**
   * Fetch the current user's profile from the API.
   */
  static async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<{ data: User }>("/auth/me", {
      skipAuthRefresh: true,
    });
    return response.data.data;
  }
}
