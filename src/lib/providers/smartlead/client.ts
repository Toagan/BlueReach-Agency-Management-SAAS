// Smartlead API Client with Per-Request API Key Support
// This client is instantiated per-campaign with its own API key

import { ProviderError } from "../types";

const SMARTLEAD_API_BASE = "https://server.smartlead.ai/api/v1";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export class SmartleadApiClient {
  private apiKey: string;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new ProviderError(
        "Smartlead API key is required",
        "smartlead"
      );
    }
    this.apiKey = apiKey;
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(`${SMARTLEAD_API_BASE}${endpoint}`);

    // Add API key as query parameter (Smartlead's auth method)
    url.searchParams.append("api_key", this.apiKey);

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

  // Rate limiting: 5 requests per 2 seconds (conservative to avoid 429s)
  // Smartlead's actual limit seems stricter than documented
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowMs = 2000; // 2 seconds
    const maxRequests = 5; // Reduced from 10 to be more conservative

    if (now - this.lastRequestTime > windowMs) {
      // Reset window
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    if (this.requestCount >= maxRequests) {
      const waitTime = windowMs - (now - this.lastRequestTime);
      if (waitTime > 0) {
        console.log(`[Smartlead] Rate limit approaching, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
        this.requestCount = 0;
        this.lastRequestTime = Date.now();
      }
    }

    this.requestCount++;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, params } = options;

    await this.enforceRateLimit();

    const url = this.buildUrl(endpoint, params);

    const headers: Record<string, string> = {
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
          // Cap wait time at 10 seconds to avoid long delays
          // Even if Smartlead says 60s, we'll retry sooner with exponential backoff
          const suggestedWait = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
          const waitTime = Math.min(suggestedWait, 10000) * (retries + 1);
          console.log(`[Smartlead] Rate limited (429), waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
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
        errorData.message || errorData.error || "Unknown Smartlead API error",
        "smartlead",
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

  // DELETE request helper
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}
