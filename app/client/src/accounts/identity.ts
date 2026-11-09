/**
 * People sign in with their ID number. The sign-in service needs an e-mail address,
 * so each ID number maps to an address that no mail is ever sent to.
 */
const EMAIL_DOMAIN = "users.lesson.invalid";

export const MIN_PASSWORD_LENGTH = 6;

export function emailForIdNumber(idNumber: string): string {
  return `${idNumber.trim()}@${EMAIL_DOMAIN}`;
}

export function isValidIdNumber(idNumber: string): boolean {
  return /^[0-9]{5,9}$/.test(idNumber.trim());
}
