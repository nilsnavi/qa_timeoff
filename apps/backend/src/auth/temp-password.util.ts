import { randomBytes } from 'crypto';

export function generateTempPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  let result = '';
  const rand = randomBytes(8);
  for (let i = 0; i < 4; i++) {
    result += letters[rand[i] % letters.length];
  }
  result += '-';
  for (let i = 4; i < 8; i++) {
    result += digits[rand[i] % digits.length];
  }
  return result;
}
