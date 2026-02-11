/* ========================================================================
   ProMail — API Client
   Production-grade fetch wrapper with error handling & auth
   ======================================================================== */

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = "/api";
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
      },
      ...options,
    };

    // Remove Content-Type for FormData (browser sets multipart boundary)
    if (options.body instanceof FormData) {
      const headers = {
        ...((options.headers as Record<string, string>) || {}),
      };
      delete headers["Content-Type"];
      config.headers = headers;
    }

    const response = await fetch(url, config);

    if (response.status === 401) {
      // if on a protected page, redirect to login
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.href = "/login?session=expired";
      }
      throw new ApiError("Session expired. Please login again.", 401);
    }

    if (!response.ok) {
      let errorMessage = `Request failed (${response.status})`;
      try {
        const err = await response.json();
        errorMessage = err.error || err.message || errorMessage;
      } catch {
        // ignore json parse errors
      }
      throw new ApiError(errorMessage, response.status);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, string | number>,
  ): Promise<T> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.set(key, String(value));
        }
      });
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request<T>(url);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data instanceof FormData ? data : JSON.stringify(data ?? {}),
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data ?? {}),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: formData,
    });
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const api = new ApiClient();
