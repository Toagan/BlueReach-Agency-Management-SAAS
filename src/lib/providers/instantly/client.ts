// Instantly API Client with Per-Request API Key Support
// This client is instantiated per-campaign with its own API key

import { ProviderError } from "../types";

const INSTANTLY_API_BASE = "https://api.instantly.ai/api/v2";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export class InstantlyApiClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new ProviderError(
        "Instantly API key is required",
        "instantly"
      );
    }
    this.apiKey = apiKey;
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(`${INSTANTLY_API_BASE}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, params } = options;
    const url = this.buildUrl(endpoint, params);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    let response: Response;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        response = await fetch(url, fetchOptions);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, retries) * 1000;
          console.log(`[Instantly] Rate limited, waiting ${waitTime}ms before retry`);
          await this.sleep(waitTime);
          retries++;
          continue;
        }

        break;
      } catch (error) {
        if (retries >= maxRetries - 1) throw error;
        retries++;
        await this.sleep(Math.pow(2, retries) * 1000);
      }
    }

    if (!response!.ok) {
      let errorData: { error?: string; message?: string } = {};
      try {
        errorData = await response!.json();
      } catch {
        errorData = { error: `HTTP ${response!.status}: ${response!.statusText}` };
      }
      throw new ProviderError(
        errorData.message || errorData.error || "Unknown Instantly API error",
        "instantly",
        response!.status,
        errorData
      );
    }

    // Handle empty responses
    const text = await response!.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  // GET request helper
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", params });
  }

  // POST request helper
  async post<T>(
    endpoint: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body, params });
  }

  // PATCH request helper
  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: "PATCH", body });
  }

  // DELETE request helper
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}
