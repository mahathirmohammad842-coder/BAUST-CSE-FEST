import type {
  EnterpriseNotificationPreferences,
  NotificationSoundEventType,
  NotificationSoundPreset,
  NotificationTypeSoundPreference,
  ProfileNotificationPreferences,
} from '../types';

export type AudioPermissionState = 'unlocked' | 'locked' | 'unsupported';
export type SoundPlaybackOutcome =
  | 'played'
  | 'muted'
  | 'locked'
  | 'unsupported';

export interface NotificationSoundTypeMeta {
  id: NotificationSoundEventType;
  label: string;
  description: string;
  defaultSound: NotificationSoundPreset;
  priorityWeight: number;
}

export interface NotificationSoundPresetMeta {
  id: NotificationSoundPreset;
  label: string;
  styleTag: string;
}

export const NOTIFICATION_SOUND_PRESETS: NotificationSoundPresetMeta[] = [
  { id: 'teams_chime', label: 'Teams Chime', styleTag: 'Warm dual tone' },
  { id: 'discord_pop', label: 'Discord Pop', styleTag: 'Crisp double pluck' },
  { id: 'slack_knock', label: 'Slack Knock', styleTag: 'Clean triad brush' },
  { id: 'crisp_bell', label: 'Crisp Bell', styleTag: 'Bright crystal ping' },
  { id: 'approval_chime', label: 'Approval Chime', styleTag: 'Ascending chord' },
  { id: 'soft_drop', label: 'Soft Drop', styleTag: 'Gentle muted tone' },
  { id: 'alert_pulse', label: 'Alert Pulse', styleTag: 'Analytical pulse' },
  { id: 'urgent_siren', label: 'Urgent Alert', styleTag: 'High-priority chime' },
];

export const NOTIFICATION_SOUND_TYPES: NotificationSoundTypeMeta[] = [
  {
    id: 'general',
    label: 'General Notification',
    description: 'Standard portal notices, reminders, and activity updates.',
    defaultSound: 'discord_pop',
    priorityWeight: 1,
  },
  {
    id: 'announcement',
    label: 'Announcement',
    description: 'Published event broadcasts, schedule changes, and venue updates.',
    defaultSound: 'teams_chime',
    priorityWeight: 2,
  },
  {
    id: 'new_message',
    label: 'New Message',
    description: 'Direct organizer messages, replies, and info request responses.',
    defaultSound: 'crisp_bell',
    priorityWeight: 3,
  },
  {
    id: 'approval_request',
    label: 'Approval Request',
    description: 'New user registrations and role requests awaiting review.',
    defaultSound: 'slack_knock',
    priorityWeight: 4,
  },
  {
    id: 'approval_granted',
    label: 'Approval Granted',
    description: 'Account approvals and role promotion confirmations.',
    defaultSound: 'approval_chime',
    priorityWeight: 5,
  },
  {
    id: 'approval_rejected',
    label: 'Approval Rejected',
    description: 'Declined role requests or rejected verification updates.',
    defaultSound: 'soft_drop',
    priorityWeight: 6,
  },
  {
    id: 'system_alert',
    label: 'System Alert',
    description: 'Incident escalations, security events, and operational alerts.',
    defaultSound: 'alert_pulse',
    priorityWeight: 7,
  },
  {
    id: 'high_priority',
    label: 'High Priority Alert',
    description: 'Emergency broadcasts and critical severity incident reports.',
    defaultSound: 'urgent_siren',
    priorityWeight: 8,
  },
];

export const NOTIFICATION_EVENT_PRIORITY: Record<
  NotificationSoundEventType,
  number
> = {
  general: 1,
  announcement: 2,
  new_message: 3,
  approval_request: 4,
  approval_granted: 5,
  approval_rejected: 6,
  system_alert: 7,
  high_priority: 8,
};

const VALID_PRESETS = new Set<NotificationSoundPreset>(
  NOTIFICATION_SOUND_PRESETS.map((p) => p.id)
);

export function createDefaultPerTypeSoundSettings(): Record<
  NotificationSoundEventType,
  NotificationTypeSoundPreference
> {
  return {
    general: { enabled: true, sound: 'discord_pop' },
    announcement: { enabled: true, sound: 'teams_chime' },
    approval_request: { enabled: true, sound: 'slack_knock' },
    approval_granted: { enabled: true, sound: 'approval_chime' },
    approval_rejected: { enabled: true, sound: 'soft_drop' },
    new_message: { enabled: true, sound: 'crisp_bell' },
    system_alert: { enabled: true, sound: 'alert_pulse' },
    high_priority: { enabled: true, sound: 'urgent_siren' },
  };
}

export const DEFAULT_ENTERPRISE_NOTIFICATION_PREFS: EnterpriseNotificationPreferences =
  {
    email: true,
    push: true,
    inApp: true,
    securityAlerts: true,
    soundEnabled: true,
    muteAll: false,
    dndEnabled: false,
    volume: 75,
    perType: createDefaultPerTypeSoundSettings(),
  };

export function normalizeEnterpriseNotificationPreferences(
  raw: unknown,
  fallbackChannels?: Partial<ProfileNotificationPreferences>
): EnterpriseNotificationPreferences {
  const defaults = createDefaultPerTypeSoundSettings();
  const obj =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawPerType =
    obj.perType && typeof obj.perType === 'object'
      ? (obj.perType as Record<string, unknown>)
      : obj.per_type_settings && typeof obj.per_type_settings === 'object'
        ? (obj.per_type_settings as Record<string, unknown>)
        : {};

  const perType = { ...defaults };
  for (const meta of NOTIFICATION_SOUND_TYPES) {
    const entry = rawPerType[meta.id];
    if (entry && typeof entry === 'object') {
      const entryObj = entry as Record<string, unknown>;
      const sound =
        typeof entryObj.sound === 'string' &&
        VALID_PRESETS.has(entryObj.sound as NotificationSoundPreset)
          ? (entryObj.sound as NotificationSoundPreset)
          : defaults[meta.id].sound;
      perType[meta.id] = {
        enabled:
          typeof entryObj.enabled === 'boolean' ? entryObj.enabled : true,
        sound,
      };
    }
  }

  const rawVol =
    typeof obj.volume === 'number' && Number.isFinite(obj.volume)
      ? Math.round(obj.volume)
      : 75;

  return {
    email:
      typeof obj.email === 'boolean'
        ? obj.email
        : typeof obj.email_enabled === 'boolean'
          ? obj.email_enabled
          : fallbackChannels?.email ?? true,
    push:
      typeof obj.push === 'boolean'
        ? obj.push
        : typeof obj.push_enabled === 'boolean'
          ? obj.push_enabled
          : fallbackChannels?.push ?? true,
    inApp:
      typeof obj.inApp === 'boolean'
        ? obj.inApp
        : typeof obj.in_app_enabled === 'boolean'
          ? obj.in_app_enabled
          : fallbackChannels?.inApp ?? true,
    securityAlerts:
      typeof obj.securityAlerts === 'boolean'
        ? obj.securityAlerts
        : typeof obj.security_alerts_enabled === 'boolean'
          ? obj.security_alerts_enabled
          : fallbackChannels?.securityAlerts ?? true,
    soundEnabled:
      typeof obj.soundEnabled === 'boolean'
        ? obj.soundEnabled
        : typeof obj.sound_enabled === 'boolean'
          ? obj.sound_enabled
          : true,
    muteAll:
      typeof obj.muteAll === 'boolean'
        ? obj.muteAll
        : typeof obj.mute_all === 'boolean'
          ? obj.mute_all
          : false,
    dndEnabled:
      typeof obj.dndEnabled === 'boolean'
        ? obj.dndEnabled
        : typeof obj.dnd_enabled === 'boolean'
          ? obj.dnd_enabled
          : false,
    volume: Math.max(0, Math.min(100, rawVol)),
    perType,
  };
}

// ============================================================================
// WEB AUDIO API SOUND ENGINE (Teams / Discord / Slack Inspired Synthesis)
// ============================================================================

interface ToneStep {
  freq: number;
  startOffsetSec: number;
  durationSec: number;
  wave: OscillatorType;
  gainScale?: number;
  harmonicFreq?: number;
}

const PRESET_PATTERNS: Record<NotificationSoundPreset, ToneStep[]> = {
  // Warm ascending major third (Microsoft Teams feel)
  teams_chime: [
    {
      freq: 659.25,
      harmonicFreq: 1318.5,
      startOffsetSec: 0,
      durationSec: 0.16,
      wave: 'sine',
      gainScale: 0.85,
    },
    {
      freq: 830.61,
      harmonicFreq: 1661.22,
      startOffsetSec: 0.11,
      durationSec: 0.28,
      wave: 'sine',
      gainScale: 1.0,
    },
  ],
  // Snappy marimba double-pluck (Discord feel)
  discord_pop: [
    {
      freq: 783.99,
      startOffsetSec: 0,
      durationSec: 0.085,
      wave: 'triangle',
      gainScale: 0.9,
    },
    {
      freq: 1046.5,
      startOffsetSec: 0.075,
      durationSec: 0.14,
      wave: 'triangle',
      gainScale: 0.95,
    },
  ],
  // Crisp three-note brush knock (Slack feel)
  slack_knock: [
    {
      freq: 587.33,
      startOffsetSec: 0,
      durationSec: 0.075,
      wave: 'triangle',
      gainScale: 0.85,
    },
    {
      freq: 739.99,
      startOffsetSec: 0.07,
      durationSec: 0.075,
      wave: 'triangle',
      gainScale: 0.9,
    },
    {
      freq: 880.0,
      startOffsetSec: 0.14,
      durationSec: 0.18,
      wave: 'sine',
      gainScale: 0.95,
    },
  ],
  // Bright crystal bell ping for direct messages
  crisp_bell: [
    {
      freq: 880.0,
      harmonicFreq: 1760.0,
      startOffsetSec: 0,
      durationSec: 0.24,
      wave: 'sine',
      gainScale: 0.9,
    },
    {
      freq: 1174.66,
      startOffsetSec: 0.09,
      durationSec: 0.24,
      wave: 'sine',
      gainScale: 0.75,
    },
  ],
  // Uplifting confirmation arpeggio for Approval Granted
  approval_chime: [
    {
      freq: 523.25,
      startOffsetSec: 0,
      durationSec: 0.1,
      wave: 'sine',
      gainScale: 0.75,
    },
    {
      freq: 659.25,
      startOffsetSec: 0.08,
      durationSec: 0.11,
      wave: 'sine',
      gainScale: 0.85,
    },
    {
      freq: 783.99,
      startOffsetSec: 0.16,
      durationSec: 0.12,
      wave: 'sine',
      gainScale: 0.9,
    },
    {
      freq: 1046.5,
      startOffsetSec: 0.24,
      durationSec: 0.3,
      wave: 'sine',
      gainScale: 1.0,
    },
  ],
  // Gentle muted downward interval for Approval Rejected
  soft_drop: [
    {
      freq: 440.0,
      startOffsetSec: 0,
      durationSec: 0.15,
      wave: 'sine',
      gainScale: 0.75,
    },
    {
      freq: 329.63,
      startOffsetSec: 0.13,
      durationSec: 0.26,
      wave: 'sine',
      gainScale: 0.8,
    },
  ],
  // Analytical operational pulse for System Alert
  alert_pulse: [
    {
      freq: 698.46,
      startOffsetSec: 0,
      durationSec: 0.11,
      wave: 'triangle',
      gainScale: 0.85,
    },
    {
      freq: 932.33,
      startOffsetSec: 0.12,
      durationSec: 0.12,
      wave: 'triangle',
      gainScale: 0.9,
    },
    {
      freq: 698.46,
      startOffsetSec: 0.25,
      durationSec: 0.2,
      wave: 'sine',
      gainScale: 0.8,
    },
  ],
  // Urgent high-priority triple chime (clean, attention-commanding, never harsh)
  urgent_siren: [
    {
      freq: 783.99,
      harmonicFreq: 1567.98,
      startOffsetSec: 0,
      durationSec: 0.11,
      wave: 'triangle',
      gainScale: 1.0,
    },
    {
      freq: 1174.66,
      startOffsetSec: 0.11,
      durationSec: 0.12,
      wave: 'triangle',
      gainScale: 1.0,
    },
    {
      freq: 783.99,
      harmonicFreq: 1567.98,
      startOffsetSec: 0.25,
      durationSec: 0.11,
      wave: 'triangle',
      gainScale: 1.0,
    },
    {
      freq: 1174.66,
      startOffsetSec: 0.36,
      durationSec: 0.28,
      wave: 'sine',
      gainScale: 1.0,
    },
  ],
};

let sharedAudioContext: AudioContext | null = null;
let listenersBound = false;
const statusListeners = new Set<(status: AudioPermissionState) => void>();

function resolveAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

export function getAudioUnlockStatus(): AudioPermissionState {
  const Ctor = resolveAudioContextCtor();
  if (!Ctor) return 'unsupported';
  if (!sharedAudioContext) return 'locked';
  return sharedAudioContext.state === 'running' ? 'unlocked' : 'locked';
}

function notifyStatusListeners(): void {
  const current = getAudioUnlockStatus();
  for (const listener of statusListeners) {
    listener(current);
  }
}

function ensureAudioContext(): AudioContext | null {
  const Ctor = resolveAudioContextCtor();
  if (!Ctor) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new Ctor();
    sharedAudioContext.onstatechange = () => {
      notifyStatusListeners();
    };
  }
  return sharedAudioContext;
}

export async function unlockNotificationAudio(): Promise<AudioPermissionState> {
  const ctx = ensureAudioContext();
  if (!ctx) return 'unsupported';
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      notifyStatusListeners();
      return 'locked';
    }
  }
  const next = getAudioUnlockStatus();
  notifyStatusListeners();
  return next;
}

export function bindAudioGestureUnlock(): () => void {
  if (typeof window === 'undefined') return () => {};
  const Ctor = resolveAudioContextCtor();
  if (!Ctor) return () => {};

  const handleUserGesture = () => {
    void unlockNotificationAudio().then((state) => {
      if (state === 'unlocked' && listenersBound) {
        cleanup();
      }
    });
  };

  const cleanup = () => {
    window.removeEventListener('pointerdown', handleUserGesture);
    window.removeEventListener('keydown', handleUserGesture);
    window.removeEventListener('touchstart', handleUserGesture);
    listenersBound = false;
  };

  if (!listenersBound && getAudioUnlockStatus() !== 'unlocked') {
    listenersBound = true;
    window.addEventListener('pointerdown', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleUserGesture, { passive: true });
    window.addEventListener('touchstart', handleUserGesture, { passive: true });
  }

  return cleanup;
}

export function subscribeAudioUnlockStatus(
  listener: (status: AudioPermissionState) => void
): () => void {
  statusListeners.add(listener);
  listener(getAudioUnlockStatus());
  return () => {
    statusListeners.delete(listener);
  };
}

function scheduleToneSequence(
  ctx: AudioContext,
  preset: NotificationSoundPreset,
  volumePercent: number
): void {
  const normalizedVol = Math.max(0, Math.min(1, volumePercent / 100));
  if (normalizedVol <= 0.001) return;

  const masterGain = ctx.createGain();
  // Keep peak comfortable (~0.28 max) so chimes never clip or distort
  masterGain.gain.value = 0.28 * normalizedVol;
  masterGain.connect(ctx.destination);

  const steps = PRESET_PATTERNS[preset] ?? PRESET_PATTERNS.teams_chime;
  const now = ctx.currentTime + 0.015;

  for (const step of steps) {
    const start = now + step.startOffsetSec;
    const end = start + step.durationSec;
    const stepPeak = Math.max(0.05, Math.min(1, step.gainScale ?? 0.9));

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = step.wave;
    osc.frequency.setValueAtTime(step.freq, start);

    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(stepPeak, start + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(env);
    env.connect(masterGain);

    osc.start(start);
    osc.stop(end + 0.02);

    if (step.harmonicFreq) {
      const harmonicOsc = ctx.createOscillator();
      const harmonicEnv = ctx.createGain();
      harmonicOsc.type = 'sine';
      harmonicOsc.frequency.setValueAtTime(step.harmonicFreq, start);
      harmonicEnv.gain.setValueAtTime(0.0001, start);
      harmonicEnv.gain.exponentialRampToValueAtTime(
        stepPeak * 0.22,
        start + 0.014
      );
      harmonicEnv.gain.exponentialRampToValueAtTime(0.0001, end);
      harmonicOsc.connect(harmonicEnv);
      harmonicEnv.connect(masterGain);
      harmonicOsc.start(start);
      harmonicOsc.stop(end + 0.02);
    }
  }
}

export async function playNotificationSound(
  eventType: NotificationSoundEventType,
  preferences: EnterpriseNotificationPreferences,
  options?: {
    forcePreview?: boolean;
    presetOverride?: NotificationSoundPreset;
  }
): Promise<SoundPlaybackOutcome> {
  const forcePreview = Boolean(options?.forcePreview);
  if (!forcePreview) {
    if (
      preferences.muteAll ||
      preferences.dndEnabled ||
      !preferences.soundEnabled ||
      preferences.volume <= 0
    ) {
      return 'muted';
    }
    const typePref = preferences.perType[eventType];
    if (typePref && !typePref.enabled) {
      return 'muted';
    }
  }

  const ctx = ensureAudioContext();
  if (!ctx) return 'unsupported';

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      notifyStatusListeners();
      return 'locked';
    }
  }

  if (ctx.state !== 'running') {
    notifyStatusListeners();
    return 'locked';
  }

  notifyStatusListeners();
  const effectiveVolume =
    forcePreview && preferences.volume <= 0 ? 70 : preferences.volume;
  const preset =
    options?.presetOverride ??
    preferences.perType[eventType]?.sound ??
    'teams_chime';

  try {
    scheduleToneSequence(ctx, preset, effectiveVolume);
    return 'played';
  } catch {
    return 'unsupported';
  }
}
