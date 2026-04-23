export type StructuredAddressInput = {
  addressLine?: string | null;
  district?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  buildingNo?: string | null;
  apartmentNo?: string | null;
  siteName?: string | null;
  addressNote?: string | null;
};

export type StructuredAddress = {
  addressLine: string;
  district: string | null;
  neighborhood: string | null;
  street: string | null;
  buildingNo: string | null;
  apartmentNo: string | null;
  siteName: string | null;
  addressNote: string | null;
};

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function hasStructuredAddressParts(input?: StructuredAddressInput | null) {
  if (!input) {
    return false;
  }

  return [
    input.district,
    input.neighborhood,
    input.street,
    input.buildingNo,
    input.apartmentNo,
    input.siteName,
    input.addressNote
  ].some((value) => Boolean(value?.trim()));
}

export function composeAddressLine(input?: StructuredAddressInput | null) {
  if (!input) {
    return "";
  }

  const district = cleanOptionalText(input.district);
  const neighborhood = cleanOptionalText(input.neighborhood);
  const street = cleanOptionalText(input.street);
  const buildingNo = cleanOptionalText(input.buildingNo);
  const apartmentNo = cleanOptionalText(input.apartmentNo);
  const siteName = cleanOptionalText(input.siteName);

  const streetBits = [street, buildingNo ? `No:${buildingNo}` : null, apartmentNo ? `D:${apartmentNo}` : null]
    .filter(Boolean)
    .join(" ");

  const localityBits = [neighborhood, district].filter(Boolean).join(", ");
  const leadBits = [siteName, streetBits].filter(Boolean).join(" - ");

  return [leadBits, localityBits].filter(Boolean).join(", ");
}

export function normalizeStructuredAddress(input?: StructuredAddressInput | null): StructuredAddress {
  const directAddressLine = cleanOptionalText(input?.addressLine);
  const district = cleanOptionalText(input?.district);
  const neighborhood = cleanOptionalText(input?.neighborhood);
  const street = cleanOptionalText(input?.street);
  const buildingNo = cleanOptionalText(input?.buildingNo);
  const apartmentNo = cleanOptionalText(input?.apartmentNo);
  const siteName = cleanOptionalText(input?.siteName);
  const addressNote = cleanOptionalText(input?.addressNote);

  const composedAddressLine = composeAddressLine({
    district,
    neighborhood,
    street,
    buildingNo,
    apartmentNo,
    siteName,
    addressNote
  });

  return {
    addressLine: directAddressLine ?? composedAddressLine,
    district,
    neighborhood,
    street,
    buildingNo,
    apartmentNo,
    siteName,
    addressNote
  };
}

export function formatAddressMeta(address: StructuredAddressInput | null | undefined) {
  if (!address) {
    return "";
  }

  return [address.neighborhood, address.district].filter(Boolean).join(" / ");
}

export function buildMapQuery(
  address: StructuredAddressInput | null | undefined,
  fallbackAddressLine: string,
  city?: string | null
) {
  const normalized = normalizeStructuredAddress({
    ...address,
    addressLine: fallbackAddressLine
  });

  return [
    normalized.siteName,
    normalized.street,
    normalized.buildingNo ? `No:${normalized.buildingNo}` : null,
    normalized.apartmentNo ? `D:${normalized.apartmentNo}` : null,
    normalized.neighborhood,
    normalized.district,
    city?.trim() || null,
    normalized.addressLine
  ]
    .filter(Boolean)
    .join(", ");
}
