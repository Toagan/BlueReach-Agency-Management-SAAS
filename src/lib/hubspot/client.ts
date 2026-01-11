// HubSpot API Client
// Documentation: https://developers.hubspot.com/docs/api/crm/contacts

import type {
  HubSpotContact,
  HubSpotContactInput,
  HubSpotNote,
  HubSpotNoteInput,
  HubSpotSearchRequest,
  HubSpotSearchResponse,
  HubSpotError as HubSpotErrorResponse,
} from "./types";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export class HubSpotApiError extends Error {
  statusCode: number;
  details: HubSpotErrorResponse;

  constructor(message: string, statusCode: number, details: HubSpotErrorResponse) {
    super(message);
    this.name = "HubSpotApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class HubSpotClient {
  private accessToken: string;

  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error("HubSpot access token is required");
    }
    this.accessToken = accessToken;
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(`${HUBSPOT_API_BASE}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { method = "GET", body, params } = options;

    const url = this.buildUrl(endpoint, params);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
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
          console.log(`[HubSpot] Rate limited, waiting ${waitTime}ms`);
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
      let errorData: HubSpotErrorResponse;
      try {
        errorData = await response!.json();
      } catch {
        errorData = {
          status: "error",
          message: `HTTP ${response!.status}: ${response!.statusText}`,
        };
      }
      throw new HubSpotApiError(
        errorData.message || "Unknown error",
        response!.status,
        errorData
      );
    }

    const text = await response!.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================
  // CONTACTS API
  // ============================================

  /**
   * Search for a contact by email
   */
  async findContactByEmail(email: string): Promise<HubSpotContact | null> {
    const searchRequest: HubSpotSearchRequest = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "EQ",
              value: email,
            },
          ],
        },
      ],
      properties: [
        "email",
        "firstname",
        "lastname",
        "phone",
        "company",
        "lead_source",
        "campaign_name",
      ],
      limit: 1,
    };

    const response = await this.request<HubSpotSearchResponse<HubSpotContact>>(
      "/crm/v3/objects/contacts/search",
      {
        method: "POST",
        body: searchRequest,
      }
    );

    return response.results.length > 0 ? response.results[0] : null;
  }

  /**
   * Create a new contact
   */
  async createContact(input: HubSpotContactInput): Promise<HubSpotContact> {
    return this.request<HubSpotContact>("/crm/v3/objects/contacts", {
      method: "POST",
      body: input,
    });
  }

  /**
   * Update an existing contact
   */
  async updateContact(
    contactId: string,
    input: HubSpotContactInput
  ): Promise<HubSpotContact> {
    return this.request<HubSpotContact>(
      `/crm/v3/objects/contacts/${contactId}`,
      {
        method: "PATCH",
        body: input,
      }
    );
  }

  /**
   * Create or update a contact by email (upsert)
   */
  async upsertContact(input: HubSpotContactInput): Promise<HubSpotContact> {
    const existingContact = await this.findContactByEmail(
      input.properties.email
    );

    if (existingContact) {
      return this.updateContact(existingContact.id, input);
    }

    return this.createContact(input);
  }

  // ============================================
  // NOTES API
  // ============================================

  /**
   * Create a note and associate it with a contact
   */
  async createNote(
    contactId: string,
    noteBody: string
  ): Promise<HubSpotNote> {
    const noteInput: HubSpotNoteInput = {
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: new Date().toISOString(),
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 202, // Note to Contact association
            },
          ],
        },
      ],
    };

    return this.request<HubSpotNote>("/crm/v3/objects/notes", {
      method: "POST",
      body: noteInput,
    });
  }

  // ============================================
  // VERIFICATION
  // ============================================

  /**
   * Test the API connection by getting the authenticated user info
   */
  async testConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      // Try to search for contacts (empty search) to verify API access
      await this.request<HubSpotSearchResponse<HubSpotContact>>(
        "/crm/v3/objects/contacts/search",
        {
          method: "POST",
          body: {
            filterGroups: [],
            limit: 1,
          },
        }
      );
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error:
          error instanceof Error ? error.message : "Failed to connect to HubSpot",
      };
    }
  }
}

// Factory function to create a HubSpot client for a specific client
export async function getHubSpotClientForClient(
  clientId: string
): Promise<HubSpotClient | null> {
  // Only works server-side
  if (typeof window !== "undefined") {
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get the HubSpot access token from settings
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", `client_${clientId}_hubspot_access_token`)
    .single();

  if (error || !data?.value) {
    return null;
  }

  return new HubSpotClient(data.value);
}

// Check if HubSpot is enabled for a client
export async function isHubSpotEnabledForClient(
  clientId: string
): Promise<boolean> {
  if (typeof window !== "undefined") {
    return false;
  }

  const { createClient } = await import("@supabase/supabase-js");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return false;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", `client_${clientId}_hubspot_enabled`)
    .single();

  return data?.value === "true";
}
