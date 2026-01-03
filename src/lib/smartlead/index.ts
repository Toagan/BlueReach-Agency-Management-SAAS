// Smartlead API Library
// Export all functions and types for use in the application

// Client
export { getSmartleadClient, SmartleadApiClient, SmartleadError, clearApiKeyCache } from "./client";

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
} from "./types";
