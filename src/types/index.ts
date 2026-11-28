export type WorkspaceRole =
  | 'Organizer'
  | 'Participant'
  | 'Volunteer'
  | 'Judge'
  | 'Guest'
  | 'Sponsor'
  | 'Mentor'
  | 'Admin'
  | 'Super Admin';

export type RegistrableRole = Exclude<
  WorkspaceRole,
  'Organizer' | 'Admin' | 'Super Admin'
>;

export type VerificationStatus = 'Pending' | 'Verified' | 'Rejected';

export type AssignableRole = WorkspaceRole;

export type RegistrationStatus = 'Pending Approval' | 'Approved' | 'Rejected';

export interface RegistrationRequest {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: RegistrableRole;
  assignedRole?: WorkspaceRole;
  affiliation: string;
  registeredAt: string;
  status: RegistrationStatus;
  verificationStatus?: VerificationStatus;
  lastLoginAt?: string;
  recommendedAction?: 'Approve' | 'Reject' | null;
  recommendedRole?: WorkspaceRole | null;
  recommendedById?: string | null;
  recommendedByName?: string | null;
  recommendationNotes?: string | null;
  recommendedAt?: string | null;
  passwordSalt: string;
  passwordHash: string;
  reviewedAt?: string;
  trashedAt?: string;
}

export interface RegistrationInput {
  fullName: string;
  email: string;
  phone: string;
  role: RegistrableRole;
  affiliation: string;
  password: string;
}

export type SettingsSection =
  | 'account'
  | 'notifications'
  | 'security'
  | 'appearance'
  | 'help';

export interface OrganizerProfile {
  fullName: string;
  organizerId: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  accountStatus: 'Active' | 'Inactive';
  lastLogin: string;
}

export interface OrganizerSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  announcementUpdates: boolean;
  securityAlerts: boolean;
  twoFactorEnabled: boolean;
  sessionTimeoutEnabled: boolean;
}

export type UserRole = WorkspaceRole;

export type ProfileAccountStatus =
  | 'Active'
  | 'Pending Approval'
  | 'Rejected'
  | 'Suspended';

export type ProfileSection = 'overview' | 'security' | 'notifications' | 'activity';

export interface ProfileSocialLinks {
  website: string;
  linkedIn: string;
  github: string;
}

export interface ProfileNotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  securityAlerts: boolean;
}

export interface UserProfile {
  userId: string;
  role: WorkspaceRole;
  requestedRole?: RegistrableRole;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  institution: string;
  biography: string;
  photoDataUrl: string;
  socialLinks: ProfileSocialLinks;
  notificationPreferences: ProfileNotificationPreferences;
  accountStatus: ProfileAccountStatus;
  verified: boolean;
  verificationStatus?: VerificationStatus;
  createdAt: string;
  lastLoginAt?: string | null;
  canManageApprovals?: boolean;
  recommendedAction?: 'Approve' | 'Reject' | null;
  recommendedRole?: WorkspaceRole | null;
  recommendedById?: string | null;
  recommendedByName?: string | null;
  recommendationNotes?: string | null;
  recommendedAt?: string | null;
  trashedAt?: string;
}

export type ProfileAuditAction =
  | 'profile-updated'
  | 'profile-verified'
  | 'profile-unverified'
  | 'account-suspended'
  | 'account-reactivated'
  | 'password-changed'
  | 'password-reset'
  | 'notifications-updated';

export interface ProfileAuditEvent {
  id: string;
  userId: string;
  actorId: string;
  actorName: string;
  action: ProfileAuditAction;
  occurredAt: string;
  summary: string;
}

export interface ProfileLoginEvent {
  id: string;
  userId: string;
  occurredAt: string;
  method: 'password' | 'demo';
}

export interface ProfileCredential {
  salt: string;
  hash: string;
}

export interface RoleChangeLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  previousRole: WorkspaceRole;
  newRole: WorkspaceRole;
  changedById: string;
  changedByName: string;
  changedAt: string;
  notes: string;
}

export type ApprovalLogAction =
  | 'approved'
  | 'rejected'
  | 'recommended'
  | 'status_changed'
  | 'permission_granted'
  | 'permission_revoked';

export interface ApprovalLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: ApprovalLogAction;
  requestedRole: string;
  assignedRole: string;
  previousStatus: string;
  newStatus: string;
  actorId: string;
  actorName: string;
  createdAt: string;
  approvalNotes: string;
}

export interface VerificationLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  verifiedById: string;
  verifiedByName: string;
  verifiedAt: string;
  verificationNotes: string;
}

export interface ProfileState {
  profiles: UserProfile[];
  events: ProfileAuditEvent[];
  loginHistory: ProfileLoginEvent[];
  credentials: Record<string, ProfileCredential>;
  passwordResetRequired: string[];
  roleChangeLogs?: RoleChangeLog[];
  approvalLogs?: ApprovalLog[];
  verificationLogs?: VerificationLog[];
}

export type NotificationChannel =
  | 'In-App'
  | 'Email'
  | 'SMS'
  | 'Push Notification'
  | 'Web Notification';

export type NotificationType =
  | 'General'
  | 'Schedule / Room Change'
  | 'Competition Update'
  | 'Emergency Alert'
  | 'Food & Logistics'
  | 'Ceremony';

export type NotificationPriority = 'Low' | 'Normal' | 'High' | 'Emergency';

export type DeliveryStatus =
  | 'Delivered'
  | 'Pending'
  | 'Scheduled'
  | 'Failed'
  | 'Draft';

export type AnnouncementCategory =
  | 'Programming Contest'
  | 'Hackathon'
  | 'Robotics Challenge'
  | 'Gaming Arena'
  | 'Tech Seminar'
  | 'Ceremony'
  | 'Logistics & Hospitality'
  | 'Safety & Campus';

export type AttachmentFileType =
  | 'PDF'
  | 'Word'
  | 'Excel'
  | 'PowerPoint'
  | 'Image'
  | 'Archive'
  | 'Text'
  | 'Schedule'
  | 'Map';

export interface Attachment {
  id: string;
  announcementId: string;
  fileName: string;
  fileType: AttachmentFileType;
  fileSizeBytes: number;
  fileSizeLabel: string;
  mockUrl: string;
  downloadCount: number;
  viewCount?: number;
  mimeType?: string;
  dataUrl?: string;
  storagePath?: string;
}

export interface AttachmentDeliveryOptions {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export interface TargetingCriteria {
  everyoneAttending: boolean;
  roles: UserRole[];
  audienceGroups: string[];
  rooms: string[];
  eventSessions: string[];
  competitions: string[];
  categories: AnnouncementCategory[];
  individualUsers: string[];
}

export interface ChannelDeliverySummary {
  channel: NotificationChannel;
  targetedCount: number;
  deliveredCount: number;
  pendingCount: number;
  failedCount: number;
  readCount: number;
  clickCount: number;
}

export type DeliveryErrorCode =
  | 'SMS_GATEWAY_TIMEOUT'
  | 'INVALID_PUSH_TOKEN'
  | 'EMAIL_BOUNCE'
  | 'WEB_SUBSCRIPTION_EXPIRED'
  | 'CARRIER_RATE_LIMIT';

export interface NotificationDelivery {
  id: string;
  announcementId: string;
  recipientId: string;
  recipientName: string;
  recipientRole: UserRole;
  recipientContact: string;
  channel: NotificationChannel;
  status: 'Delivered' | 'Pending' | 'Failed';
  errorCode?: DeliveryErrorCode;
  errorMessage?: string;
  attemptCount: number;
  lastAttemptAt: string;
  deliveredAt?: string;
  readAt?: string;
  clickedAt?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  summary: string;
  type: NotificationType;
  category: AnnouncementCategory;
  priority: NotificationPriority;
  status: DeliveryStatus;
  channels: NotificationChannel[];
  targeting: TargetingCriteria;
  senderName: string;
  senderRole: UserRole;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  scheduledFor?: string;
  expiresAt?: string;
  timezone: 'Asia/Dhaka';
  attachments: Attachment[];
  attachmentDelivery?: AttachmentDeliveryOptions;
  actionLabel?: string;
  actionUrl?: string;
  totalRecipients: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  readCount: number;
  clickCount: number;
  channelBreakdown: ChannelDeliverySummary[];
  isReadByCurrentRole?: Partial<Record<UserRole, boolean>>;
  isReadByUserId?: Record<string, boolean>;
  trashedAt?: string;
  trashedBy?: string;
}

export interface UserPreferenceMatrix {
  role: UserRole;
  browserPushEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  digestFrequency: 'Instant' | 'Hourly' | 'Daily Summary';
  channelsByType: Record<NotificationType, Record<NotificationChannel, boolean>>;
}

export interface SystemUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  affiliation: string;
  badgeCode: string;
  createdAt?: string;
  assignedRoom?: string;
  teamOrGroup?: string;
}

export interface ActivityFeedEntry {
  id: string;
  announcementId: string;
  announcementTitle: string;
  eventDescription: string;
  channel: NotificationChannel;
  status: 'Delivered' | 'Scheduled' | 'Failed' | 'Retried';
  timestamp: string;
  recipientCount: number;
}

export interface DailyEngagementPoint {
  label: string;
  dateIso: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}
