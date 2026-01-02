export function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  let cleaned = phone.replace(/\D/g, ''); // digits only

  // Remove country prefixes if present
  if (cleaned.startsWith('880')) cleaned = cleaned.slice(3); // 88017...
  else if (cleaned.startsWith('88')) cleaned = cleaned.slice(2); // 8817... (rare)

  // Now must be local BD format: 01XXXXXXXXX (11 digits)
  if (!/^01[3-9]\d{8}$/.test(cleaned)) return null;

  // Convert to E.164: +88017XXXXXXXX
  return `+880${cleaned.slice(1)}`;
}

export function isValidBangladeshPhone(phone?: string | null): boolean {
  return !!normalizePhoneNumber(phone || '');
}
