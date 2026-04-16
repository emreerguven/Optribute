export function normalizePhone(phone: string) {
  const digits = phone.trim().replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("0090") && digits.length === 14) {
    return digits.slice(4);
  }

  if (digits.startsWith("90") && digits.length === 12) {
    return digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return digits.slice(1);
  }

  return digits;
}
