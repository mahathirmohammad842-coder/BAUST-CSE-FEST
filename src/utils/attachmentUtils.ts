import type { Announcement, NotificationChannel } from '../types';

export function getAttachmentsForChannel(
  announcement: Announcement,
  channel: NotificationChannel
) {
  const options = announcement.attachmentDelivery;
  const included =
    channel === 'In-App'
      ? options?.inApp !== false
      : channel === 'Email'
        ? options?.email !== false
        : channel === 'Push Notification'
          ? options?.push !== false
          : true;

  return included ? announcement.attachments : [];
}
