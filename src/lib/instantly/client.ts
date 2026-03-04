// Instantly API V2 Client

import { createClient } from "@supabase/supabase-js";
import type { InstantlyApiError } from "./types";

const INSTANTLY_API_BASE = "https://api.instantly.ai/api/v2";

// Cache for API key from database (keyed by ownerId)
const apiKeyCache = new Map<string, { key: string; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

// Fetch API key from database settings (scoped by owner)
async function getApiKeyFromDatabase(ownerId?: string): Promise<string | null> {
  const cacheKey = ownerId || "_default";
  const cached = apiKeyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.key;
  }

  try {
    // Only works server-side
    if (typeof window !== "undefined") {
      return null;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from("settings")
      .select("value")
      .eq("key", "instantly_api_key");

    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }

    const { data, error } = await query.single();

    if (error || !data?.value) {
      return null;
    }

    // Update cache
    apiKeyCache.set(cacheKey, { key: data.value, timestamp: Date.now() });

    return data.value;
  } catch {
    return null;
  }
}

// Clear the cache (useful when settings are updated)
export function clearApiKeyCache(): void {
  apiKeyCache.clear();
}

class InstantlyApiClient {
  private apiKey: string;
  private apiKeyPromise: Promise<string> | null = null;
  private ownerId?: string;

  constructor(apiKey?: string, ownerId?: string) {
    this.apiKey = apiKey || process.env.INSTANTLY_API_KEY || "";
    this.ownerId = ownerId;
  }

  // Lazy load API key from database if not set
  private async getApiKey(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }

    // Try to get from database
    const dbKey = await getApiKeyFromDatabase(this.ownerId);
    if (dbKey) {
      this.apiKey = dbKey;
      return dbKey;
    }

    // Fall back to environment variable
    this.apiKey = process.env.INSTANTLY_API_KEY || "";
    return this.apiKey;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
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

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, params } = options;

    // Get API key (from cache, database, or env)
    const apiKey = await this.getApiKey();

    if (!apiKey) {
      throw new Error("Instantly API key not configured. Please set it in Settings.");
    }

    const url = this.buildUrl(endpoint, params);

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
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
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retries) * 1000;
          console.log(`Rate limited, waiting ${waitTime}ms before retry`);
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
      let errorData: InstantlyApiError;
      try {
        errorData = await response!.json();
      } catch {
        errorData = { error: `HTTP ${response!.status}: ${response!.statusText}` };
      }
      throw new InstantlyError(
        errorData.message || errorData.error || "Unknown error",
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // GET request helper
  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", params });
  }

  // POST request helper
  async post<T>(endpoint: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
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

  // Check if API is configured (sync check - for quick checks)
  isConfigured(): boolean {
    return !!(this.apiKey || cachedApiKey || process.env.INSTANTLY_API_KEY);
  }

  // Async check if API is configured
  async isConfiguredAsync(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return !!apiKey;
  }
}

// Custom error class for Instantly API errors
export class InstantlyError extends Error {
  statusCode: number;
  details: InstantlyApiError;

  constructor(message: string, statusCode: number, details: InstantlyApiError) {
    super(message);
    this.name = "InstantlyError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Singleton instance (used when no ownerId needed, e.g. env-based key)
let clientInstance: InstantlyApiClient | null = null;

export function getInstantlyClient(ownerId?: string): InstantlyApiClient {
  // Per-owner: always create a fresh instance (no singleton)
  if (ownerId) {
    return new InstantlyApiClient(undefined, ownerId);
  }
  if (!clientInstance) {
    clientInstance = new InstantlyApiClient();
  }
  return clientInstance;
}

// Export the class for custom instances
export { InstantlyApiClient };
