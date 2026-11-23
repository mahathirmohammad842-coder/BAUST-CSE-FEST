import type { RegistrationRequest } from '../types';

export const REGISTRATION_STORAGE_KEY = 'baust_registration_requests';
const PASSWORD_ITERATIONS = 210_000;

function isRegistrationRequest(value: unknown): value is RegistrationRequest {
  if (typeof value !== 'object' || value === null) return false;
  const request = value as Partial<RegistrationRequest>;
  return (
    typeof request.id === 'string' &&
    typeof request.fullName === 'string' &&
    typeof request.email === 'string' &&
    typeof request.phone === 'string' &&
    typeof request.role === 'string' &&
    ['Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor'].includes(
      request.role
    ) &&
    typeof request.affiliation === 'string' &&
    typeof request.registeredAt === 'string' &&
    !Number.isNaN(Date.parse(request.registeredAt)) &&
    ['Pending Approval', 'Approved', 'Rejected'].includes(
      request.status ?? ''
    ) &&
    typeof request.passwordSalt === 'string' &&
    typeof request.passwordHash === 'string'
  );
}

export function loadRegistrationRequests(): RegistrationRequest[] {
  try {
    const stored = window.localStorage.getItem(REGISTRATION_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isRegistrationRequest) : [];
  } catch {
    return [];
  }
}

export function saveRegistrationRequests(requests: RegistrationRequest[]) {
  window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(requests));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PASSWORD_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(bits));
}

export async function hashRegistrationPassword(password: string) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: toHex(salt),
    hash: await derivePasswordHash(password, salt),
  };
}

export async function verifyRegistrationPassword(
  password: string,
  saltHex: string,
  expectedHash: string
) {
  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []
  );
  if (salt.length !== 16) return false;
  const actualHash = await derivePasswordHash(password, salt);
  return actualHash === expectedHash;
}
