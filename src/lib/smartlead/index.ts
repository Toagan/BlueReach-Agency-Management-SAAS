// Smartlead API Library
// Export all functions and types for use in the application

// Client
export { getSmartleadClient, SmartleadApiClient, SmartleadError, clearApiKeyCache } from "./client";

// Campaign functions
export {
  fetchSmartleadCampaigns,
  fetchAllSmartleadCampaigns,
  fetchSmartleadCampaign,
} from "./campaigns";

// Analytics functions
export { getSmartleadCampaignAnalytics } from "./analytics";

// Account functions
export {
  fetchSmartleadAccounts,
  fetchSmartleadAccount,
  getSmartleadWarmupStats,
  getSmartleadWarmupAnalytics,
  enableSmartleadWarmup,
  disableSmartleadWarmup,
  fetchSmartleadAccountsWithWarmup,
} from "./accounts";

// Types
export type {
  SmartleadApiError,
  SmartleadAccount,
  SmartleadWarmupStats,
  SmartleadWarmupDayStats,
  SmartleadCampaign,
  SmartleadLead,
  SmartleadListResponse,
  SmartleadSyncResult,
  SmartleadCampaignAnalytics,
  SmartleadWebhookPayload,
} from "./types";
