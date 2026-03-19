export const WHITELISTED_EMAILS = [
  "yannick.rastogi@gmail.com",
];

export function isEmailWhitelisted(email: string): boolean {
  return WHITELISTED_EMAILS.includes(email.toLowerCase());
}
