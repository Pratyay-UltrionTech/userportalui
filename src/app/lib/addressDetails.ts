export type AddressDetails = {
  street_address: string;
  suburb: string;
  state: string;
  postcode: string;
};

export type AddressDetailsWithFullAddress = AddressDetails & {
  full_address: string;
};

export const AU_STATES: Array<{ code: string; name: string }> = [
  { code: 'NSW', name: 'New South Wales' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'SA', name: 'South Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'ACT', name: 'Australian Capital Territory' },
  { code: 'NT', name: 'Northern Territory' },
];

export function sanitizePostcode(value: string): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

export function createEmptyAddressDetails(postcode = ''): AddressDetails {
  return {
    street_address: '',
    suburb: '',
    state: '',
    postcode: sanitizePostcode(postcode),
  };
}

export function composeFullAddress(address: AddressDetails): string {
  const statePostcode = [address.state.trim(), sanitizePostcode(address.postcode)].filter(Boolean).join(' ');
  return [address.street_address.trim(), address.suburb.trim(), statePostcode].filter(Boolean).join(', ');
}

export function withFullAddress(address: AddressDetails): AddressDetailsWithFullAddress {
  return {
    ...address,
    postcode: sanitizePostcode(address.postcode),
    full_address: composeFullAddress(address),
  };
}

export function validateRequiredAddress(address: AddressDetails): Record<keyof AddressDetails, string> {
  const postcode = sanitizePostcode(address.postcode);
  return {
    street_address: address.street_address.trim() ? '' : 'Street address is required',
    suburb: address.suburb.trim() ? '' : 'Suburb is required',
    state: address.state.trim() ? '' : 'State is required',
    postcode: postcode ? '' : 'Postcode is required',
  };
}

export function isAddressComplete(address: AddressDetails): boolean {
  const errors = validateRequiredAddress(address);
  return !errors.street_address && !errors.suburb && !errors.state && !errors.postcode;
}

export function parseAddressString(rawAddress: string | null | undefined): Partial<AddressDetails> {
  const raw = String(rawAddress ?? '').trim();
  if (!raw) return {};
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  const maybeTail = parts[parts.length - 1] ?? '';
  const tailMatch = maybeTail.match(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b(?:\s+(\d{4,6}))?/i);
  const state = tailMatch?.[1]?.toUpperCase() ?? '';
  const postcode = sanitizePostcode(tailMatch?.[2] ?? '');
  if (parts.length === 1 && !state && !postcode) {
    return { street_address: parts[0] };
  }
  return {
    street_address: parts[0] ?? '',
    suburb: parts.length >= 3 ? (parts[1] ?? '') : '',
    state,
    postcode,
  };
}
