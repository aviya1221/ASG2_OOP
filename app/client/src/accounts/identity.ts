/** People sign in with their email. No mail is sent to it: it only says who the person is. */
export const MIN_PASSWORD_LENGTH = 6;

/** The email as the product keeps it: with no spaces around it, and in small letters. */
export function normalEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}
