import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  MoonStar,
  Play,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  UserX,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  EnterpriseNotificationPreferences,
  NotificationSoundEventType,
  NotificationSoundPreset,
} from '../types';
import {
  type AudioPermissionState,
  DEFAULT_ENTERPRISE_NOTIFICATION_PREFS,
  NOTIFICATION_SOUND_PRESETS,
  NOTIFICATION_SOUND_TYPES,
  playNotificationSound,
  subscribeAudioUnlockStatus,
  unlockNotificationAudio,
} from '../lib/notificationSound';

interface NotificationPreferencesPanelProps {
  preferences: EnterpriseNotificationPreferences;
  onChangePreferences: (next: EnterpriseNotificationPreferences) => void;
  onTestPopup?: (eventType: NotificationSoundEventType) => void;
}

const EVENT_TYPE_ICONS: Record<NotificationSoundEventType, typeof Bell> = {
  general: Bell,
  announcement: Megaphone,
  approval_request: UserCheck,
  approval_granted: CheckCircle2,
  approval_rejected: UserX,
  new_message: MessageSquare,
  system_alert: ShieldAlert,
  high_priority: AlertTriangle,
};

function PreferenceSwitch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3.5 last:border-0 dark:border-emerald-900/60">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-emerald-50">
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-emerald-200/65">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked
            ? 'bg-emerald-600 dark:bg-emerald-400'
            : 'bg-slate-300 dark:bg-emerald-900'
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

export function NotificationPreferencesPanel({
  preferences,
  onChangePreferences,
  onTestPopup,
}: NotificationPreferencesPanelProps) {
  const [audioStatus, setAudioStatus] =
    useState<AudioPermissionState>('locked');
  const [testEventType, setTestEventType] =
    useState<NotificationSoundEventType>('announcement');
  const [previewFeedback, setPreviewFeedback] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAudioUnlockStatus(setAudioStatus);
  }, []);

  const updateField = <K extends keyof EnterpriseNotificationPreferences>(
    key: K,
    value: EnterpriseNotificationPreferences[K]
  ) => {
    onChangePreferences({
      ...preferences,
      [key]: value,
    });
  };

  const updatePerType = (
    eventType: NotificationSoundEventType,
    patch: Partial<{ enabled: boolean; sound: NotificationSoundPreset }>
  ) => {
    onChangePreferences({
      ...preferences,
      perType: {
        ...preferences.perType,
        [eventType]: {
          ...preferences.perType[eventType],
          ...patch,
        },
      },
    });
  };

  const handleEnableBrowserAudio = async () => {
    const nextState = await unlockNotificationAudio();
    setAudioStatus(nextState);
    if (nextState === 'unlocked') {
      setPreviewFeedback('Browser audio unlocked and ready for live alerts.');
      await playNotificationSound(testEventType, preferences, {
        forcePreview: true,
      });
    } else if (nextState === 'unsupported') {
      setPreviewFeedback('Web Audio API is unavailable in this browser.');
    }
  };

  const handlePreviewSound = async (
    eventType: NotificationSoundEventType,
    withPopup = false
  ) => {
    const outcome = await playNotificationSound(eventType, preferences, {
      forcePreview: true,
    });
    if (withPopup && onTestPopup) {
      onTestPopup(eventType);
    }
    if (outcome === 'played') {
      const meta = NOTIFICATION_SOUND_TYPES.find((t) => t.id === eventType);
      setPreviewFeedback(
        `Played ${meta?.label ?? 'notification'} sound preview at ${preferences.volume > 0 ? preferences.volume : 70}% volume.`
      );
    } else if (outcome === 'locked') {
      setPreviewFeedback(
        'Browser autoplay is locked. Click "Enable Browser Audio" above to allow playback.'
      );
    } else if (outcome === 'unsupported') {
      setPreviewFeedback('Audio playback is unsupported in this browser.');
    }
  };

  const isAudioEffectivelySilenced =
    preferences.muteAll || preferences.dndEnabled || !preferences.soundEnabled;

  return (
    <div className="space-y-7">
      {/* Browser Audio Permission Status */}
      {audioStatus === 'locked' && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <Volume2
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                Browser audio permission required for background chimes
              </p>
              <p className="mt-0.5 text-xs text-amber-900/75 dark:text-amber-200/70">
                Browsers pause audio until you interact with the page. Enable audio once so live alerts ring automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleEnableBrowserAudio()}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Enable Browser Audio
          </button>
        </div>
      )}

      {/* Master Sound & Focus Controls */}
      <div>
        <div className="mb-3 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/60">
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-emerald-50">
              Sound &amp; Focus Controls
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-emerald-200/60">
              Configure desktop &amp; mobile alert chimes, volume, and Do Not Disturb mode.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Notification sound type to test"
              value={testEventType}
              onChange={(event) =>
                setTestEventType(event.target.value as NotificationSoundEventType)
              }
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100"
            >
              {NOTIFICATION_SOUND_TYPES.map((typeMeta) => (
                <option key={typeMeta.id} value={typeMeta.id}>
                  {typeMeta.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handlePreviewSound(testEventType, true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#064E3B] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#053D2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:bg-emerald-400 dark:text-[#022017] dark:hover:bg-emerald-300"
            >
              <Volume2 className="h-3.5 w-3.5" />
              Test Notification Sound
            </button>
          </div>
        </div>

        {previewFeedback && (
          <p
            role="status"
            className="mb-3 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200"
          >
            {previewFeedback}
          </p>
        )}

        <PreferenceSwitch
          label="Enable notification sound"
          description="Play crisp alert chimes automatically whenever a new notification arrives in real time."
          checked={preferences.soundEnabled}
          onChange={() => updateField('soundEnabled', !preferences.soundEnabled)}
        />

        <PreferenceSwitch
          label="Do Not Disturb (DND)"
          description="Suppress sounds and floating popup alerts while unread notification badges continue updating silently."
          checked={preferences.dndEnabled}
          onChange={() => updateField('dndEnabled', !preferences.dndEnabled)}
        />

        <PreferenceSwitch
          label="Mute all notifications"
          description="Silence all notification sounds and pause popup alerts across every category."
          checked={preferences.muteAll}
          onChange={() => updateField('muteAll', !preferences.muteAll)}
        />

        {/* Volume Slider */}
        <div className="flex flex-col gap-3 border-b border-slate-100 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/60">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-emerald-50">
              {preferences.volume === 0 || isAudioEffectivelySilenced ? (
                <VolumeX className="h-4 w-4 text-slate-400 dark:text-emerald-300/60" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              )}
              Master volume control
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-emerald-200/65">
              {preferences.dndEnabled
                ? 'Do Not Disturb is active — live alerts are silenced.'
                : preferences.muteAll
                  ? 'All notification sounds are muted.'
                  : !preferences.soundEnabled
                    ? 'Notification sounds are turned off.'
                    : 'Adjust chime playback level across desktop and mobile.'}
            </p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-64">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              aria-label="Notification sound volume"
              value={preferences.volume}
              onChange={(event) =>
                updateField('volume', Number(event.target.value))
              }
              className="h-2 w-full cursor-pointer accent-emerald-600 dark:accent-emerald-400"
            />
            <span className="w-11 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-slate-800 dark:text-emerald-100">
              {preferences.volume}%
            </span>
          </div>
        </div>

        {(preferences.dndEnabled || preferences.muteAll) && (
          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-emerald-200/75">
            {preferences.dndEnabled ? (
              <MoonStar className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
            ) : (
              <BellOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
            )}
            <span>
              {preferences.dndEnabled
                ? 'DND active: incoming real-time notifications will update your badge silently without popups or audio.'
                : 'Muted: incoming real-time notifications will show popups without playing audio.'}
            </span>
          </div>
        )}
      </div>

      {/* Sound Per Notification Type */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-emerald-900/60">
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-emerald-50">
              Sound Per Notification Type
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-emerald-200/60">
              Assign distinct audio chimes or silence individual notification categories.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onChangePreferences({
                ...preferences,
                soundEnabled: DEFAULT_ENTERPRISE_NOTIFICATION_PREFS.soundEnabled,
                muteAll: DEFAULT_ENTERPRISE_NOTIFICATION_PREFS.muteAll,
                dndEnabled: DEFAULT_ENTERPRISE_NOTIFICATION_PREFS.dndEnabled,
                volume: DEFAULT_ENTERPRISE_NOTIFICATION_PREFS.volume,
                perType: { ...DEFAULT_ENTERPRISE_NOTIFICATION_PREFS.perType },
              })
            }
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <RotateCcw className="h-3 w-3" />
            Reset sound defaults
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-emerald-900/60">
          {NOTIFICATION_SOUND_TYPES.map((typeMeta) => {
            const Icon = EVENT_TYPE_ICONS[typeMeta.id];
            const typePref = preferences.perType[typeMeta.id] ?? {
              enabled: true,
              sound: typeMeta.defaultSound,
            };

            return (
              <div
                key={typeMeta.id}
                className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-emerald-50">
                      {typeMeta.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-emerald-200/60">
                      {typeMeta.description}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:ml-4">
                  <select
                    aria-label={`${typeMeta.label} sound preset`}
                    value={typePref.sound}
                    disabled={!typePref.enabled}
                    onChange={(event) => {
                      const nextSound = event.target
                        .value as NotificationSoundPreset;
                      updatePerType(typeMeta.id, { sound: nextSound });
                      void playNotificationSound(typeMeta.id, preferences, {
                        forcePreview: true,
                        presetOverride: nextSound,
                      });
                    }}
                    className="min-h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600 disabled:opacity-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100"
                  >
                    {NOTIFICATION_SOUND_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label} ({preset.styleTag})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    aria-label={`Preview ${typeMeta.label} sound`}
                    title={`Play ${typeMeta.label} chime`}
                    onClick={() => void handlePreviewSound(typeMeta.id, false)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={typePref.enabled}
                    aria-label={`Enable sound for ${typeMeta.label}`}
                    onClick={() =>
                      updatePerType(typeMeta.id, { enabled: !typePref.enabled })
                    }
                    className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                      typePref.enabled
                        ? 'bg-emerald-600 dark:bg-emerald-400'
                        : 'bg-slate-300 dark:bg-emerald-900'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        typePref.enabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivery Channels */}
      <div>
        <div className="mb-1 border-b border-slate-100 pb-3 dark:border-emerald-900/60">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-emerald-50">
            Delivery Channels
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-emerald-200/60">
            Choose which channels receive fest announcements and account security notices.
          </p>
        </div>

        <PreferenceSwitch
          label="In-app announcements"
          description="Show real-time fest notices, replies, and updates inside your portal."
          checked={preferences.inApp}
          onChange={() => updateField('inApp', !preferences.inApp)}
        />
        <PreferenceSwitch
          label="Push notifications"
          description="Receive browser alerts for time-sensitive schedule and venue changes."
          checked={preferences.push}
          onChange={() => updateField('push', !preferences.push)}
        />
        <PreferenceSwitch
          label="Email notifications"
          description="Receive summary digests and critical announcement confirmations by email."
          checked={preferences.email}
          onChange={() => updateField('email', !preferences.email)}
        />
        <PreferenceSwitch
          label="Security alerts"
          description="Get notified about role changes, password updates, and account status changes."
          checked={preferences.securityAlerts}
          onChange={() =>
            updateField('securityAlerts', !preferences.securityAlerts)
          }
        />
      </div>
    </div>
  );
}
