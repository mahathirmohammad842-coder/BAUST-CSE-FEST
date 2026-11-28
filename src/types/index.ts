export type WorkspaceRole =
  | 'Organizer'
  | 'Participant'
  | 'Volunteer'
  | 'Judge'
  | 'Guest'
  | 'Sponsor'
  | 'Mentor'
  | 'Super Admin';

export type RegistrableRole = Exclude<
  WorkspaceRole,
  'Organizer' | 'Super Admin'
>;

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

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
  approvalStatus?: ApprovalStatus;
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
  department: string;
  institution: string;
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
  | 'Suspended'
  | 'Archived'
  | 'Deleted';

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

export interface ProfilePersonalInfo {
  studentId: string;
  batch: string;
  tshirtSize: string;
  emergencyContact: string;
  dietaryNotes: string;
}

export interface UserProfile {
  userId: string;
  role: WorkspaceRole;
  assignedRole?: WorkspaceRole;
  requestedRole?: RegistrableRole;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  institution: string;
  address: string;
  personalInfo: ProfilePersonalInfo;
  biography: string;
  photoDataUrl: string;
  socialLinks: ProfileSocialLinks;
  notificationPreferences: ProfileNotificationPreferences;
  accountStatus: ProfileAccountStatus;
  approvalStatus: ApprovalStatus;
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
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedByName?: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archivedByName?: string;
  restoredAt?: string | null;
  restoredBy?: string | null;
  restoredByName?: string;
  presenceStatus?: PresenceStatus;
  lastSeenAt?: string | null;
}

export type PresenceStatus = 'Online' | 'Away' | 'Offline';

export interface PresenceUserEntry {
  userId: string;
  fullName: string;
  email: string;
  role: WorkspaceRole;
  avatarUrl?: string;
  department?: string;
  institution?: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  currentSessionId?: string;
  currentRoute?: string;
  activeSessionsCount?: number;
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

export interface ActivityLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  actorId: string;
  actorName: string;
  action: string;
  category: 'auth' | 'profile' | 'governance' | 'security' | 'notifications';
  details: string;
  createdAt: string;
}

export type UserDeletionAuditAction =
  | 'soft_deleted'
  | 'archived'
  | 'restored'
  | 'unarchived'
  | 'permanently_deleted';

export interface UserDeletionAuditLog {
  id: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  targetUserRole: string;
  action: UserDeletionAuditAction;
  actorId: string;
  actorName: string;
  notes: string;
  deletedAt?: string | null;
  restoredAt?: string | null;
  restoredBy?: string | null;
  restoredByName?: string;
  permanentlyDeletedAt?: string | null;
  createdAt: string;
}

export interface RolePermissionEntry {
  role: WorkspaceRole;
  hierarchyLevel: number;
  canManageUsers: boolean;
  canApproveUsers: boolean;
  canRecommendApprovals: boolean;
  canVerifyUsers: boolean;
  canChangeRoles: boolean;
  canAssignOrganizer: boolean;
  canAssignSuperAdmin: boolean;
  canPublishAnnouncements: boolean;
  canAccessOrganizerPanel: boolean;
  canAccessSuperAdminPanel: boolean;
  canAccessJudgeFeatures: boolean;
  canManageEvents: boolean;
  canArchiveUsers?: boolean;
  canSoftDeleteUsers?: boolean;
  canRestoreUsers?: boolean;
  canPermanentlyDeleteUsers?: boolean;
}

export type AnnouncementAuditAction =
  | 'created'
  | 'updated'
  | 'published'
  | 'soft_deleted'
  | 'restored'
  | 'permanently_deleted';

export interface AnnouncementAuditLog {
  id: string;
  announcementId: string;
  announcementTitle: string;
  action: AnnouncementAuditAction;
  actorId: string;
  actorName: string;
  actorRole: string;
  notes: string;
  createdAt: string;
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
  activityLogs?: ActivityLogEntry[];
  deletionAuditLogs?: UserDeletionAuditLog[];
  announcementAuditLogs?: AnnouncementAuditLog[];
  rolePermissions?: RolePermissionEntry[];
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
  senderId?: string;
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
  trashedById?: string;
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

export interface OrganizerContact {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: WorkspaceRole;
  department: string;
  institution: string;
  photoUrl: string;
  presenceStatus: PresenceStatus;
  lastSeenAt: string | null;
}

export interface OrganizerMessageReply {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorRole: WorkspaceRole;
  body: string;
  isStaffReply: boolean;
  deliveryStatus: 'Sent' | 'Delivered' | 'Read';
  readAt?: string | null;
  createdAt: string;
}

export interface OrganizerMessageThread {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderRole: WorkspaceRole;
  recipientOrganizerId: string | null;
  recipientOrganizerName: string;
  subject: string;
  body: string;
  status: 'Sent' | 'Delivered' | 'Read' | 'Replied';
  readAt?: string | null;
  repliedAt?: string | null;
  replyCount: number;
  lastMessageAt: string;
  createdAt: string;
  replies: OrganizerMessageReply[];
}

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IncidentStatus = 'Open' | 'Investigating' | 'Resolved' | 'Closed';

export interface IncidentReport {
  id: string;
  referenceCode: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reporterRole: WorkspaceRole;
  category: string;
  location: string;
  severity: IncidentSeverity;
  description: string;
  status: IncidentStatus;
  assignedToId?: string | null;
  assignedToName?: string;
  resolutionNotes: string;
  resolvedAt?: string | null;
  resolvedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export type InfoRequestStatus = 'Pending' | 'Answered' | 'Closed';

export interface EventInfoRequest {
  id: string;
  referenceCode: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole: WorkspaceRole;
  topic: string;
  question: string;
  status: InfoRequestStatus;
  responseText: string;
  respondedById?: string | null;
  respondedByName?: string;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffNotificationAlert {
  id: string;
  userId: string;
  announcementId: string;
  title: string;
  body: string;
  channel: string;
  priority: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}
