export type WorkspaceRole =
  | 'Organizer'
  | 'Participant'
  | 'Volunteer'
  | 'Judge'
  | 'Guest'
  | 'Sponsor'
  | 'Mentor';

export type RegistrableRole = Exclude<WorkspaceRole, 'Organizer'>;

export type RegistrationStatus = 'Pending Approval' | 'Approved' | 'Rejected';

export interface RegistrationRequest {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: RegistrableRole;
  affiliation: string;
  registeredAt: string;
  status: RegistrationStatus;
  passwordSalt: string;
  passwordHash: string;
  reviewedAt?: string;
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

export type UserRole = WorkspaceRole | 'Admin';

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

export interface Attachment {
  id: string;
  announcementId: string;
  fileName: string;
  fileType: 'PDF' | 'Image' | 'Schedule' | 'Map';
  fileSizeBytes: number;
  fileSizeLabel: string;
  mockUrl: string;
  downloadCount: number;
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
