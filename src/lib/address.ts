export const ADDRESS_QUALITY_STATUSES = ["verified", "partial", "failed"] as const;
export type AddressQualityStatus = (typeof ADDRESS_QUALITY_STATUSES)[number];

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

export type AddressSnapshot = {
  rawAddressLine: string;
  normalizedAddressLine: string;
  qualityStatus: AddressQualityStatus;
  structuredAddress: StructuredAddress;
};

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/[;,]+/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*-\s*/g, " - ")
    .trim()
    .replace(/,+$/g, "");
}

function normalizeAddressFragment(value?: string | null) {
  const cleaned = cleanOptionalText(value);

  if (!cleaned) {
    return null;
  }

  return normalizeWhitespace(
    cleaned
      .replace(/\bmah\.?\b/giu, "Mahallesi")
      .replace(/\bmh\.?\b/giu, "Mahallesi")
      .replace(/\bcad\.?\b/giu, "Caddesi")
      .replace(/\bcd\.?\b/giu, "Caddesi")
      .replace(/\bblv\.?\b/giu, "Bulvarı")
      .replace(/\bblv\b/giu, "Bulvarı")
      .replace(/\bsok\.?\b/giu, "Sokak")
      .replace(/\bsk\.?\b/giu, "Sokak")
      .replace(/\bapt\.?\b/giu, "Apartmanı")
      .replace(/\baptm\.?\b/giu, "Apartmanı")
      .replace(/\bno\s*[:.-]?\s*/giu, "No: ")
      .replace(/\bd[.:]\s*/giu, "D: ")
  );
}

function includesToken(value: string, token: string) {
  return value.toLocaleLowerCase("tr-TR").includes(token.toLocaleLowerCase("tr-TR"));
}

function appendContext(value: string, context: string | null) {
  if (!context || includesToken(value, context)) {
    return value;
  }

  return normalizeWhitespace(`${value}, ${context}`);
}

function getMapsFriendlySiteName(value?: string | null) {
  const normalized = normalizeAddressFragment(value);

  if (!normalized) {
    return null;
  }

  if (/\b(Apartmanı|Apartman|Apt)\b/iu.test(normalized) || /\bBlok\b/iu.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeWhatsAppPhone(phone: string) {
  const digits = phone.trim().replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("0090") && digits.length === 14) {
    return digits.slice(2);
  }

  if (digits.startsWith("90") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `90${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `90${digits}`;
  }

  return digits;
}

function containsNeighborhoodSignal(value: string) {
  return /\bMahallesi\b/iu.test(value);
}

function containsStreetSignal(value: string) {
  return /\b(Caddesi|Sokak|Bulvarı)\b/iu.test(value);
}

function containsBuildingSignal(value: string) {
  return /\bNo:\s*[0-9A-Za-z/-]+\b/iu.test(value);
}

function containsSiteSignal(value: string) {
  return /\b(Sitesi|Plaza|İş Merkezi)\b/iu.test(value);
}

function containsNoteHeavySignal(value: string) {
  return /\b(zil|interkom|kapı|güvenlik|blok|daire|kat|tarif|giriş|kod)\b/iu.test(value);
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

function composeAddressLineInternal(input?: StructuredAddressInput | null, normalize = false) {
  if (!input) {
    return "";
  }

  const clean = normalize ? normalizeAddressFragment : cleanOptionalText;
  const district = clean(input.district);
  const neighborhood = clean(input.neighborhood);
  const street = clean(input.street);
  const buildingNo = cleanOptionalText(input.buildingNo);
  const apartmentNo = cleanOptionalText(input.apartmentNo);
  const siteName = clean(input.siteName);

  const streetBits = [
    street,
    buildingNo ? `No: ${buildingNo}` : null,
    apartmentNo ? `D: ${apartmentNo}` : null
  ]
    .filter(Boolean)
    .join(" ");

  const localityBits = [neighborhood, district].filter(Boolean).join(", ");
  const leadBits = [siteName, streetBits].filter(Boolean).join(" - ");

  return normalizeWhitespace([leadBits, localityBits].filter(Boolean).join(", "));
}

export function composeAddressLine(input?: StructuredAddressInput | null) {
  return composeAddressLineInternal(input, false);
}

export function normalizeStructuredAddress(input?: StructuredAddressInput | null): StructuredAddress {
  const directAddressLine = normalizeAddressFragment(input?.addressLine);
  const district = normalizeAddressFragment(input?.district);
  const neighborhood = normalizeAddressFragment(input?.neighborhood);
  const street = normalizeAddressFragment(input?.street);
  const buildingNo = cleanOptionalText(input?.buildingNo);
  const apartmentNo = cleanOptionalText(input?.apartmentNo);
  const siteName = normalizeAddressFragment(input?.siteName);
  const addressNote = normalizeAddressFragment(input?.addressNote);

  const composedAddressLine = composeAddressLineInternal(
    {
      district,
      neighborhood,
      street,
      buildingNo,
      apartmentNo,
      siteName,
      addressNote
    },
    true
  );

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

export function determineAddressQuality(
  address: StructuredAddressInput | StructuredAddress | null | undefined,
  options?: {
    normalizedAddressLine?: string | null;
    city?: string | null;
  }
): AddressQualityStatus {
  if (!address) {
    return "failed";
  }

  const normalizedLine = normalizeWhitespace(
    options?.normalizedAddressLine ??
      normalizeStructuredAddress(address).addressLine ??
      ""
  );

  if (!normalizedLine || normalizedLine.length < 10) {
    return "failed";
  }

  const hasDistrict = Boolean(cleanOptionalText(address.district));
  const hasNeighborhood =
    Boolean(cleanOptionalText(address.neighborhood)) || containsNeighborhoodSignal(normalizedLine);
  const hasStreet =
    Boolean(cleanOptionalText(address.street)) || containsStreetSignal(normalizedLine);
  const hasBuilding =
    Boolean(cleanOptionalText(address.buildingNo)) || containsBuildingSignal(normalizedLine);
  const hasSite =
    Boolean(cleanOptionalText(address.siteName)) || containsSiteSignal(normalizedLine);
  const hasCity = Boolean(options?.city) ? includesToken(normalizedLine, options?.city ?? "") : false;
  const isVeryShort = normalizedLine.length < 18;
  const isNoteHeavy = containsNoteHeavySignal(normalizedLine) && !hasStreet && !hasBuilding;
  const score =
    Number(hasDistrict) +
    Number(hasNeighborhood) +
    Number(hasStreet) +
    Number(hasBuilding) +
    Number(hasSite) +
    Number(hasCity);

  if (isNoteHeavy || (isVeryShort && !hasStreet && !hasNeighborhood)) {
    return "failed";
  }

  if (hasStreet && hasBuilding && hasNeighborhood) {
    return "verified";
  }

  if ((hasStreet && hasBuilding && (hasDistrict || hasNeighborhood)) || score >= 5) {
    return "verified";
  }

  if (
    (hasStreet && (hasDistrict || hasNeighborhood) && normalizedLine.length >= 18) ||
    (hasStreet && hasBuilding) ||
    (hasNeighborhood && hasStreet && hasCity) ||
    (normalizedLine.length >= 24 && score >= 3)
  ) {
    return "partial";
  }

  return "failed";
}

export function deriveAddressSnapshot(
  input?: StructuredAddressInput | null,
  options?: {
    city?: string | null;
    rawAddressLine?: string | null;
  }
): AddressSnapshot {
  const rawAddressLine =
    cleanOptionalText(options?.rawAddressLine ?? input?.addressLine) ?? composeAddressLineInternal(input, false);
  const structuredAddress = normalizeStructuredAddress(input);
  const normalizedAddressLine = appendContext(
    structuredAddress.addressLine || normalizeAddressFragment(rawAddressLine) || "",
    cleanOptionalText(options?.city)
  );
  const qualityStatus = determineAddressQuality(
    {
      ...structuredAddress,
      addressLine: normalizedAddressLine
    },
    {
      normalizedAddressLine,
      city: options?.city
    }
  );

  return {
    rawAddressLine: rawAddressLine || normalizedAddressLine,
    normalizedAddressLine,
    qualityStatus,
    structuredAddress: {
      ...structuredAddress,
      addressLine: normalizedAddressLine
    }
  };
}

export function formatAddressMeta(address: StructuredAddressInput | null | undefined) {
  if (!address) {
    return "";
  }

  return [normalizeAddressFragment(address.neighborhood), normalizeAddressFragment(address.district)]
    .filter(Boolean)
    .join(" / ");
}

export function buildMapQuery(
  address: StructuredAddressInput | null | undefined,
  options: {
    normalizedAddressLine?: string | null;
    rawAddressLine?: string | null;
    city?: string | null;
  }
) {
  const snapshot = deriveAddressSnapshot(
    {
      ...address,
      addressLine: options.rawAddressLine ?? address?.addressLine
    },
    {
      city: options.city,
      rawAddressLine: options.rawAddressLine
    }
  );

  return [
    getMapsFriendlySiteName(snapshot.structuredAddress.siteName),
    snapshot.structuredAddress.street,
    snapshot.structuredAddress.buildingNo ? `No: ${snapshot.structuredAddress.buildingNo}` : null,
    snapshot.structuredAddress.neighborhood,
    snapshot.structuredAddress.district,
    cleanOptionalText(options.city)
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildGoogleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildGoogleMapsDirectionsUrl(stopQueries: string[]) {
  if (stopQueries.length === 0) {
    return null;
  }

  if (stopQueries.length === 1) {
    const params = new URLSearchParams({
      api: "1",
      destination: stopQueries[0]!,
      travelmode: "driving"
    });

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  const destination = stopQueries[stopQueries.length - 1]!;
  const waypoints = stopQueries.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving"
  });

  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildWhatsAppRouteShareUrl(phone: string, routeUrl: string | null) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone || !routeUrl) {
    return null;
  }

  const message = `Merhaba, teslimat rotanız hazır.\nRota linki: ${routeUrl}`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
