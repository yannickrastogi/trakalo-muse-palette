export const WHITELISTED_EMAILS = [
  "yannick.rastogi@gmail.com",
];

export function isEmailWhitelisted(email: string): boolean {
  return WHITELISTED_EMAILS.includes(email.toLowerCase());
}

// Server-side whitelist for Edge Functions (duplicated for Deno runtime)
export const WHITELISTED_EMAILS_SERVER = WHITELISTED_EMAILS;
