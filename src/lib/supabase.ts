import { createClient } from '@supabase/supabase-js';
import type { Announcement, Attachment, ProfileNotificationPreferences, ProfileSocialLinks, UserProfile, WorkspaceRole } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

const WORKSPACE_ROLES: WorkspaceRole[] = [
  'Organizer',
  'Participant',
  'Volunteer',
  'Judge',
  'Guest',
  'Sponsor',
  'Mentor',
  'Admin',
  'Super Admin',
];
const ATTACHMENT_BUCKET = 'notice-attachments';

export interface CloudProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: WorkspaceRole;
  department: string;
  institution: string;
  biography: string;
  photo_url: string;
  social_links: ProfileSocialLinks;
  notification_preferences: ProfileNotificationPreferences;
  account_status: UserProfile['accountStatus'];
  verified: boolean;
  created_at: string;
  updated_at: string;
  requested_role: string;
}

export function mapCloudProfile(row: CloudProfile): UserProfile {
  const role = WORKSPACE_ROLES.includes(row.role) ? row.role : 'Participant';
  return {
    userId: row.id,
    role,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? '',
    department: row.department ?? '',
    institution: row.institution ?? '',
    biography: row.biography ?? '',
    photoDataUrl: row.photo_url ?? '',
    socialLinks: row.social_links ?? { website: '', linkedIn: '', github: '' },
    notificationPreferences: row.notification_preferences ?? {
      email: true,
      push: true,
      inApp: true,
      securityAlerts: true,
    },
    accountStatus: row.account_status,
    verified: row.verified,
    createdAt: row.created_at,
  };
}

export async function fetchCloudProfile(userId: string): Promise<CloudProfile> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as CloudProfile;
}

export async function fetchCloudProfiles(): Promise<CloudProfile[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudProfile[];
}

export async function fetchCloudAnnouncements(): Promise<Announcement[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('announcements')
    .select('payload')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (row) => {
      const announcement = row.payload as Announcement;
      const attachments = await Promise.all(
        announcement.attachments.map(async (attachment) => {
          if (!attachment.storagePath) return attachment;
          const { data: signedUrl, error: signedUrlError } = await supabase!
            .storage.from(ATTACHMENT_BUCKET)
            .createSignedUrl(attachment.storagePath, 60 * 60);
          if (signedUrlError) throw signedUrlError;
          return {
            ...attachment,
            dataUrl: undefined,
            mockUrl: signedUrl.signedUrl,
          };
        })
      );
      return { ...announcement, attachments };
    })
  );
}

export async function deleteCloudAnnouncement(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

export async function saveCloudAnnouncements(
  announcements: Announcement[],
  userId: string
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const rows = await Promise.all(
    announcements.map(async (announcement) => {
      const attachments = await Promise.all(
        announcement.attachments.map(async (attachment) => {
          if (attachment.storagePath) {
            return {
              ...attachment,
              dataUrl: undefined,
              mockUrl: `supabase-storage:${attachment.storagePath}`,
            };
          }
          if (!attachment.dataUrl) return attachment;
          const response = await fetch(attachment.dataUrl);
          if (!response.ok) {
            throw new Error(`Could not read attachment ${attachment.fileName}.`);
          }
          const blob = await response.blob();
          const safeName = attachment.fileName.replace(/[^\w.-]/g, '_');
          const storagePath = `${userId}/${announcement.id}/${attachment.id}-${safeName}`;
          const { error: uploadError } = await supabase!.storage
            .from(ATTACHMENT_BUCKET)
            .upload(storagePath, blob, {
              contentType: attachment.mimeType ?? blob.type,
              upsert: true,
            });
          if (uploadError) throw uploadError;
          return {
            ...attachment,
            storagePath,
            mockUrl: `supabase-storage:${storagePath}`,
            dataUrl: undefined,
          } satisfies Attachment;
        })
      );
      return {
        id: announcement.id,
        payload: { ...announcement, attachments },
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };
    })
  );
  const { error } = await supabase.from('announcements').upsert(rows);
  if (error) throw error;
}

export async function saveCloudProfile(profile: UserProfile): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('user_profiles')
    .update({
      full_name: profile.fullName,
      phone: profile.phone,
      department: profile.department,
      institution: profile.institution,
      biography: profile.biography,
      photo_url: profile.photoDataUrl,
      social_links: profile.socialLinks,
      notification_preferences: profile.notificationPreferences,
    })
    .eq('id', profile.userId);
  if (error) throw error;
}

export async function fetchCloudNotificationActions(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('personal_notification_actions')
    .select('notification_id, state, events')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function saveCloudNotificationAction(
  userId: string,
  notificationId: string,
  state: object,
  events: object[]
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('personal_notification_actions').upsert(
    {
      user_id: userId,
      notification_id: notificationId,
      state,
      events,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,notification_id' }
  );
  if (error) throw error;
}
