const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });

    if (res.status === 401) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.getToken()}`;
        const retry = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
        if (!retry.ok) throw new Error(await retry.text());
        return retry.status === 204 ? (undefined as T) : retry.json();
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `HTTP ${res.status}`);
    }
    return res.status === 204 ? (undefined as T) : res.json();
  }

  private async tryRefresh(): Promise<boolean> {
    const refresh = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
    if (!refresh) return false;
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  async login(username: string, password: string) {
    const data = await this.request<{ access_token: string; refresh_token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return data;
  }

  logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }

  get = <T>(path: string) => this.request<T>(path);
  post = <T>(path: string, body?: unknown) => this.request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  put = <T>(path: string, body?: unknown) => this.request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
  del = <T>(path: string) => this.request<T>(path, { method: "DELETE" });
}

export const api = new ApiClient();
