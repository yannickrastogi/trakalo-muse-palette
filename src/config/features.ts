// Feature flags — single source of truth.
//
// Pitch and Approvals are hidden from the UI while we consolidate sharing around
// Shared Links. Nothing is deleted: pages, routes, RPCs, Edge Functions, contexts
// and i18n keys all stay in place. Flip a flag back to `true` to fully restore the
// corresponding section — no other change is required.
export const FEATURES = {
  PITCH_ENABLED: false,
  APPROVALS_ENABLED: false,
} as const;
