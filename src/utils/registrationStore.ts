import type { RegistrationRequest } from '../types';

export const REGISTRATION_STORAGE_KEY = 'baust_registration_requests';
export const DELETED_DEMO_USERS_STORAGE_KEY = 'baust_deleted_demo_users';
export const USER_BLOCK_STATE_STORAGE_KEY = 'baust_user_block_state';
const LEGACY_USER_BLOCKS_STORAGE_KEY = 'baust_temporary_user_blocks';
const PASSWORD_ITERATIONS = 210_000;

export type UserBlockReason =
  | 'Spam'
  | 'Misconduct'
  | 'Fake Registration'
  | 'Security Violation'
  | 'Policy Violation'
  | 'Other';

export type UserBlockEndReason = 'unblocked' | 'expired';

export interface UserBlockRecord {
  id: string;
  userId: string;
  blockedAt: string;
  expiresAt: string | null;
  reason: UserBlockReason;
  note: string;
  blockedById: string;
  blockedByName: string;
  endedAt?: string;
  endedById?: string;
  endedByName?: string;
  endReason?: UserBlockEndReason;
}

export type UserBlockAction =
  | 'blocked'
  | 'unblocked'
  | 'extended'
  | 'expiry-changed'
  | 'expired';

export interface UserBlockAuditEvent {
  id: string;
  blockId: string;
  userId: string;
  action: UserBlockAction;
  actorId: string;
  actorName: string;
  occurredAt: string;
  reason: UserBlockReason;
  note?: string;
  previousExpiresAt?: string | null;
  expiresAt?: string | null;
}

export interface UserBlockState {
  records: UserBlockRecord[];
  events: UserBlockAuditEvent[];
}

const EMPTY_USER_BLOCK_STATE: UserBlockState = { records: [], events: [] };
const BLOCK_REASONS: UserBlockReason[] = [
  'Spam',
  'Misconduct',
  'Fake Registration',
  'Security Violation',
  'Policy Violation',
  'Other',
];
const BLOCK_ACTIONS: UserBlockAction[] = [
  'blocked',
  'unblocked',
  'extended',
  'expiry-changed',
  'expired',
];

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isUserBlockRecord(value: unknown): value is UserBlockRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<UserBlockRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.userId === 'string' &&
    isValidDate(record.blockedAt) &&
    (record.expiresAt === null || isValidDate(record.expiresAt)) &&
    BLOCK_REASONS.includes(record.reason as UserBlockReason) &&
    typeof record.note === 'string' &&
    typeof record.blockedById === 'string' &&
    typeof record.blockedByName === 'string' &&
    (record.endedAt === undefined || isValidDate(record.endedAt)) &&
    (record.endedById === undefined || typeof record.endedById === 'string') &&
    (record.endedByName === undefined ||
      typeof record.endedByName === 'string') &&
    (record.endReason === undefined ||
      record.endReason === 'unblocked' ||
      record.endReason === 'expired')
  );
}

function isUserBlockAuditEvent(value: unknown): value is UserBlockAuditEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Partial<UserBlockAuditEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.blockId === 'string' &&
    typeof event.userId === 'string' &&
    BLOCK_ACTIONS.includes(event.action as UserBlockAction) &&
    typeof event.actorId === 'string' &&
    typeof event.actorName === 'string' &&
    isValidDate(event.occurredAt) &&
    BLOCK_REASONS.includes(event.reason as UserBlockReason) &&
    (event.note === undefined || typeof event.note === 'string') &&
    (event.previousExpiresAt === undefined ||
      event.previousExpiresAt === null ||
      isValidDate(event.previousExpiresAt)) &&
    (event.expiresAt === undefined ||
      event.expiresAt === null ||
      isValidDate(event.expiresAt))
  );
}

function loadLegacyUserBlocks(): UserBlockRecord[] {
  try {
    const stored = window.localStorage.getItem(LEGACY_USER_BLOCKS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value): UserBlockRecord[] => {
      if (typeof value !== 'object' || value === null) return [];
      const legacy = value as { userId?: unknown; blockedAt?: unknown; expiresAt?: unknown };
      if (
        typeof legacy.userId !== 'string' ||
        !isValidDate(legacy.blockedAt) ||
        !isValidDate(legacy.expiresAt)
      ) {
        return [];
      }
      return [
        {
          id: `legacy-${legacy.userId}-${legacy.blockedAt}`,
          userId: legacy.userId,
          blockedAt: legacy.blockedAt,
          expiresAt: legacy.expiresAt,
          reason: 'Other',
          note: '',
          blockedById: 'ORG-001',
          blockedByName: 'Organizer',
        },
      ];
    });
  } catch {
    return [];
  }
}

export function loadUserBlockState(): UserBlockState {
  try {
    const stored = window.localStorage.getItem(USER_BLOCK_STATE_STORAGE_KEY);
    if (!stored) {
      return {
        records: loadLegacyUserBlocks(),
        events: [],
      };
    }
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...EMPTY_USER_BLOCK_STATE };
    }
    const state = parsed as Partial<UserBlockState>;
    return {
      records: Array.isArray(state.records)
        ? state.records.filter(isUserBlockRecord)
        : [],
      events: Array.isArray(state.events)
        ? state.events.filter(isUserBlockAuditEvent)
        : [],
    };
  } catch {
    return { ...EMPTY_USER_BLOCK_STATE };
  }
}

export function saveUserBlockState(state: UserBlockState) {
  window.localStorage.setItem(USER_BLOCK_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function findActiveUserBlock(
  records: UserBlockRecord[],
  userId: string,
  now = Date.now()
): UserBlockRecord | undefined {
  return records.find(
    (record) =>
      record.userId === userId &&
      record.endedAt === undefined &&
      (record.expiresAt === null || Date.parse(record.expiresAt) > now)
  );
}

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

export function loadDeletedDemoUserIds(): string[] {
  try {
    const stored = window.localStorage.getItem(DELETED_DEMO_USERS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveDeletedDemoUserIds(ids: string[]) {
  window.localStorage.setItem(DELETED_DEMO_USERS_STORAGE_KEY, JSON.stringify(ids));
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
