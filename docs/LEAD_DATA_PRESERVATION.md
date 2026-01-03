# Lead Data Preservation Guide

This document explains how lead data is managed to ensure no data loss during Instantly sync operations.

## Lead Field Categories

### 1. LOCAL-ONLY Fields (Never overwritten by sync)
These fields are managed exclusively in the portal and should NEVER be overwritten by Instantly sync:

| Field | Description |
|-------|-------------|
| `notes` | User-entered notes about the lead |
| `deal_value` | Potential deal value entered by user |
| `next_action` | Next action to take with this lead |
| `next_action_date` | When the next action is scheduled |
| `linkedin_url` | LinkedIn profile URL |
| `phone` | Phone number (can be enriched locally) |

### 2. INSTANTLY-SOURCED Fields (Updated from Instantly API)
These fields come from Instantly and are updated during sync:

| Field | Description | Update Rule |
|-------|-------------|-------------|
| `email` | Lead email address | Never changes (primary identifier) |
| `first_name` | First name | Update if local is empty |
| `last_name` | Last name | Update if local is empty |
| `company_name` | Company name | Update if local is empty |
| `company_domain` | Company domain | Update if local is empty |
| `personalization` | Email personalization text | Update if local is empty |
| `instantly_lead_id` | Instantly's internal ID | Set once, never change |
| `instantly_created_at` | When created in Instantly | Set once, never change |
| `last_contacted_at` | Last email sent timestamp | Always update (newer is better) |
| `last_step_info` | Last email step info | Always update |
| `email_open_count` | Number of email opens | Always update (increment only) |
| `email_click_count` | Number of link clicks | Always update (increment only) |
| `email_reply_count` | Number of replies | Always update (increment only) |
| `metadata` | Additional Instantly payload data | Merge, never overwrite |

### 3. STATUS Fields (Smart Update Logic)
These fields use special logic to prevent downgrading:

| Field | Description | Update Rule |
|-------|-------------|-------------|
| `status` | Lead funnel status | Only upgrade, never downgrade |
| `is_positive_reply` | Positive classification | Only set to true, never reset to false by sync |

## Status Priority (Highest to Lowest)

```
won (8)          - Deal closed won
lost (7)         - Deal closed lost
booked (6)       - Meeting booked
replied (5)      - Lead has replied
clicked (4)      - Link clicked
opened (3)       - Email opened
contacted (2)    - Email sent
not_interested (1) - Marked not interested
```

**Rule**: Sync will only update status if the new status has HIGHER priority than current.

## Sync Behavior Summary

### Full Sync (`/api/instantly/sync`)
1. **New leads**: Creates with all Instantly data
2. **Existing leads**: Updates ONLY Instantly-sourced fields, preserves local-only fields

### Status Refresh (`/api/instantly/refresh-status`)
1. Updates email counts (open, click, reply)
2. Updates status only if higher priority
3. Updates `is_positive_reply` only if becoming positive

### Webhooks (`/api/webhooks/instantly/[campaignId]`)
1. Real-time updates for specific events
2. Sets `is_positive_reply=true` for positive events
3. Sets `is_positive_reply=false` for negative events
4. Updates status to "replied" for reply events

## Data Integrity Guarantees

1. **Notes are NEVER deleted or overwritten** by any sync operation
2. **Deal values are NEVER modified** by sync
3. **Status is NEVER downgraded** by sync (e.g., "replied" won't become "contacted")
4. **Positive reply flag can change** based on Instantly classification, but only via explicit events
5. **Email counts only increase**, never decrease
6. **Metadata is merged**, not replaced

## Implementation Notes

The sync logic uses an "upsert with field protection" pattern:

```typescript
// Fields to ALWAYS preserve (never overwrite)
const preservedFields = ['notes', 'deal_value', 'next_action', 'next_action_date'];

// Fields to only update if local is empty
const fillOnlyFields = ['first_name', 'last_name', 'company_name', 'phone', 'linkedin_url'];

// Fields to always update from Instantly
const alwaysUpdateFields = ['email_open_count', 'email_click_count', 'email_reply_count', 'last_contacted_at'];
```
