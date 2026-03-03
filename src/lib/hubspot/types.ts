// HubSpot API Types

export interface HubSpotContact {
  id: string;
  properties: {
    email: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    company?: string;
    [key: string]: string | undefined;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotContactInput {
  properties: {
    email: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    company?: string;
    lead_source?: string;
    campaign_name?: string;
    [key: string]: string | undefined;
  };
}

export interface HubSpotNote {
  id: string;
  properties: {
    hs_note_body: string;
    hs_timestamp: string;
    [key: string]: string | undefined;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotNoteInput {
  properties: {
    hs_note_body: string;
    hs_timestamp?: string;
  };
  associations?: Array<{
    to: { id: string };
    types: Array<{
      associationCategory: string;
      associationTypeId: number;
    }>;
  }>;
}

export interface HubSpotSearchRequest {
  filterGroups: Array<{
    filters: Array<{
      propertyName: string;
      operator: string;
      value: string;
    }>;
  }>;
  properties?: string[];
  limit?: number;
}

export interface HubSpotSearchResponse<T> {
  total: number;
  results: T[];
}

export interface HubSpotBatchResponse<T> {
  status: string;
  results: T[];
}

export interface HubSpotPipelineStage {
  id: string;
  label: string;
  displayOrder: number;
}

export interface HubSpotPipeline {
  id: string;
  label: string;
  stages: HubSpotPipelineStage[];
}

export interface HubSpotPropertyOption {
  label: string;
  value: string;
  displayOrder: number;
  hidden: boolean;
}

export interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options: HubSpotPropertyOption[];
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname: string;
    amount?: string;
    pipeline?: string;
    dealstage?: string;
    [key: string]: string | undefined;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotDealInput {
  properties: {
    dealname: string;
    amount?: string;
    pipeline?: string;
    dealstage?: string;
    [key: string]: string | undefined;
  };
  associations?: Array<{
    to: { id: string };
    types: Array<{
      associationCategory: string;
      associationTypeId: number;
    }>;
  }>;
}

export interface HubSpotError {
  status: string;
  message: string;
  correlationId?: string;
  category?: string;
}
