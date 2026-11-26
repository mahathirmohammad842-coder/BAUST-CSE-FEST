import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from 'react';
import {
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Paperclip,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Modal } from './Modal';
import type {
  Attachment,
  AttachmentDeliveryOptions,
  AttachmentFileType,
  NotificationChannel,
} from '../types';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

const ACCEPTED_FILES =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.zip,.txt';

interface FileRule {
  type: AttachmentFileType;
  mimeTypes: string[];
  signature: 'pdf' | 'png' | 'jpeg' | 'webp' | 'zip' | 'ole' | 'text';
}

const fileRules: Record<string, FileRule> = {
  pdf: { type: 'PDF', mimeTypes: ['application/pdf'], signature: 'pdf' },
  doc: { type: 'Word', mimeTypes: ['application/msword'], signature: 'ole' },
  docx: {
    type: 'Word',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    signature: 'zip',
  },
  xls: { type: 'Excel', mimeTypes: ['application/vnd.ms-excel'], signature: 'ole' },
  xlsx: {
    type: 'Excel',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    signature: 'zip',
  },
  ppt: {
    type: 'PowerPoint',
    mimeTypes: ['application/vnd.ms-powerpoint'],
    signature: 'ole',
  },
  pptx: {
    type: 'PowerPoint',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    signature: 'zip',
  },
  jpg: { type: 'Image', mimeTypes: ['image/jpeg'], signature: 'jpeg' },
  jpeg: { type: 'Image', mimeTypes: ['image/jpeg'], signature: 'jpeg' },
  png: { type: 'Image', mimeTypes: ['image/png'], signature: 'png' },
  webp: { type: 'Image', mimeTypes: ['image/webp'], signature: 'webp' },
  zip: {
    type: 'Archive',
    mimeTypes: ['application/zip', 'application/x-zip-compressed'],
    signature: 'zip',
  },
  txt: { type: 'Text', mimeTypes: ['text/plain'], signature: 'text' },
};

const distributionChannels: {
  key: keyof AttachmentDeliveryOptions;
  channel: NotificationChannel;
  label: string;
}[] = [
  { key: 'inApp', channel: 'In-App', label: 'Include attachments in In-App notifications' },
  { key: 'email', channel: 'Email', label: 'Include attachments in Email notifications' },
  { key: 'push', channel: 'Push Notification', label: 'Include attachment download links in Push notifications' },
];

interface AttachmentManagerProps {
  announcementId: string;
  attachments: Attachment[];
  deliveryOptions: AttachmentDeliveryOptions;
  channels: NotificationChannel[];
  onChange: (attachments: Attachment[]) => void;
  onDeliveryOptionsChange: (options: AttachmentDeliveryOptions) => void;
  onProcessingChange: (processing: boolean) => void;
}

interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
}

function createId() {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileRule(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return fileRules[extension];
}

function matchesSignature(signature: FileRule['signature'], bytes: Uint8Array) {
  const startsWith = (...expected: number[]) =>
    expected.every((byte, index) => bytes[index] === byte);

  switch (signature) {
    case 'pdf':
      return new TextDecoder().decode(bytes).includes('%PDF-');
    case 'png':
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'jpeg':
      return startsWith(0xff, 0xd8, 0xff);
    case 'webp':
      return startsWith(0x52, 0x49, 0x46, 0x46) &&
        new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
    case 'zip':
      return startsWith(0x50, 0x4b, 0x03, 0x04) ||
        startsWith(0x50, 0x4b, 0x05, 0x06) ||
        startsWith(0x50, 0x4b, 0x07, 0x08);
    case 'ole':
      return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case 'text':
      return !bytes.some((byte) => byte === 0);
  }
}

async function validateFile(file: File, rule: FileRule) {
  if (!file.size) return 'Empty files are not supported.';
  if (file.size > MAX_FILE_BYTES) return 'Files must be 10 MB or smaller.';
  const declaredMime = file.type.toLowerCase();
  if (
    declaredMime &&
    declaredMime !== 'application/octet-stream' &&
    !rule.mimeTypes.includes(declaredMime)
  ) {
    return 'The file extension and declared file type do not match.';
  }

  const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (!matchesSignature(rule.signature, header)) {
    return 'The file contents do not match a supported file format.';
  }
  return null;
}

function readAsDataUrl(
  file: File,
  onProgress: (progress: number) => void
) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onProgress(100);
        resolve(reader.result);
      } else {
        reject(new Error('The file could not be read as a previewable attachment.'));
      }
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onabort = () => reject(new Error(`Reading ${file.name} was interrupted.`));
    reader.readAsDataURL(file);
  });
}

function getAttachmentIcon(type: AttachmentFileType) {
  if (type === 'Image') return FileImage;
  if (type === 'Excel') return FileSpreadsheet;
  if (type === 'Archive') return FileArchive;
  return FileText;
}

export function AttachmentManager({
  announcementId,
  attachments,
  deliveryOptions,
  channels,
  onChange,
  onDeliveryOptionsChange,
  onProcessingChange,
}: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const totalBytes = useMemo(
    () => attachments.reduce((total, attachment) => total + attachment.fileSizeBytes, 0),
    [attachments]
  );

  const importFiles = async (fileList: FileList | File[]) => {
    if (readingRef.current) {
      setErrors(['Wait for the current files to finish importing before adding more.']);
      return;
    }

    readingRef.current = true;
    onProcessingChange(true);
    setErrors([]);
    let reservedCount = attachments.length;
    let reservedBytes = totalBytes;
    const nextAttachments = [...attachments];
    const nextErrors: string[] = [];

    try {
      for (const file of Array.from(fileList)) {
        const rule = getFileRule(file.name);
        if (!rule) {
          nextErrors.push(`${file.name}: This file type is not supported.`);
          continue;
        }
        if (reservedCount >= MAX_ATTACHMENTS) {
          nextErrors.push(`You can attach up to ${MAX_ATTACHMENTS} files.`);
          break;
        }
        if (file.size > MAX_FILE_BYTES) {
          nextErrors.push(`${file.name}: Files must be 10 MB or smaller.`);
          continue;
        }
        if (reservedBytes + file.size > MAX_TOTAL_BYTES) {
          nextErrors.push('The combined attachment size cannot exceed 25 MB.');
          continue;
        }

        let validationError: string | null;
        try {
          validationError = await validateFile(file, rule);
        } catch (error) {
          nextErrors.push(
            error instanceof Error
              ? `${file.name}: Could not validate this file. ${error.message}`
              : `${file.name}: Could not validate this file.`
          );
          continue;
        }
        if (validationError) {
          nextErrors.push(`${file.name}: ${validationError}`);
          continue;
        }

        const id = createId();
        reservedCount += 1;
        reservedBytes += file.size;
        setUploadTasks((current) => [...current, { id, fileName: file.name, progress: 0 }]);

        try {
          const dataUrl = await readAsDataUrl(file, (progress) => {
            setUploadTasks((current) =>
              current.map((task) => task.id === id ? { ...task, progress } : task)
            );
          });
          nextAttachments.push({
            id,
            announcementId,
            fileName: file.name,
            fileType: rule.type,
            fileSizeBytes: file.size,
            fileSizeLabel: formatFileSize(file.size),
            mockUrl: '',
            downloadCount: 0,
            viewCount: 0,
            mimeType: file.type || rule.mimeTypes[0],
            dataUrl,
          });
          onChange([...nextAttachments]);
        } catch (error) {
          reservedCount -= 1;
          reservedBytes -= file.size;
          nextErrors.push(error instanceof Error ? error.message : `Could not read ${file.name}.`);
        } finally {
          setUploadTasks((current) => current.filter((task) => task.id !== id));
        }
      }
    } finally {
      readingRef.current = false;
      onProcessingChange(false);
      setErrors(nextErrors);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) void importFiles(event.target.files);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length) void importFiles(event.dataTransfer.files);
  };

  const removeAttachment = (id: string) => {
    const next = attachments.filter((attachment) => attachment.id !== id);
    onChange(next);
    if (previewAttachment?.id === id) setPreviewAttachment(null);
  };

  const updateDeliveryOption = (
    key: keyof AttachmentDeliveryOptions,
    checked: boolean
  ) => onDeliveryOptionsChange({ ...deliveryOptions, [key]: checked });

  return (
    <section className="space-y-4 rounded-xl border border-emerald-200/70 bg-white p-4 sm:p-5 dark:border-emerald-800/60 dark:bg-[#061D15]">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
          <Paperclip className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-emerald-950 dark:text-emerald-50">Attachments &amp; Resources</h2>
          <p className="mt-1 text-xs leading-5 text-emerald-900/65 dark:text-emerald-200/60">
            Add event schedules, guidelines, images, and supporting files. Up to 5 files, 10 MB each, 25 MB total.
          </p>
        </div>
      </div>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          const nextTarget = event.relatedTarget;
          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors sm:px-6 ${
          isDragging
            ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/40'
            : 'border-emerald-200 bg-emerald-50/35 dark:border-emerald-800/70 dark:bg-[#041811]'
        }`}
      >
        <UploadCloud className="mx-auto h-7 w-7 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
          Drop files here or browse your device
        </p>
        <p className="mt-1 text-[11px] leading-5 text-emerald-900/60 dark:text-emerald-200/55">
          PDF, Word, Excel, PowerPoint, JPG, PNG, WebP, ZIP, or TXT
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILES}
          onChange={handleInputChange}
          className="sr-only"
          aria-label="Choose files to attach"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadTasks.length > 0}
          className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-700 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-emerald-950/40"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Browse files
        </button>
      </div>

      {uploadTasks.length > 0 && (
        <ul className="space-y-2" aria-label="Attachment import progress">
          {uploadTasks.map((task) => (
            <li key={task.id} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900/60 dark:bg-[#041811]">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium text-emerald-950 dark:text-emerald-100">{task.fileName}</span>
                <span className="shrink-0 tabular-nums text-emerald-800 dark:text-emerald-300">{task.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white dark:bg-emerald-950">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width] dark:bg-emerald-400"
                  role="progressbar"
                  aria-label={`Importing ${task.fileName}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={task.progress}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}

      {attachments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">Attached files ({attachments.length}/{MAX_ATTACHMENTS})</p>
            <p className="text-[11px] tabular-nums text-emerald-900/60 dark:text-emerald-200/55">{formatFileSize(totalBytes)} / 25 MB</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {attachments.map((attachment) => {
              const Icon = getAttachmentIcon(attachment.fileType);
              return (
                <li key={attachment.id} className="min-w-0 rounded-lg border border-emerald-100 bg-white p-3 dark:border-emerald-900/60 dark:bg-[#041811]">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-emerald-950 dark:text-emerald-100" title={attachment.fileName}>{attachment.fileName}</p>
                      <p className="mt-1 text-[10px] text-emerald-900/60 dark:text-emerald-200/55">{attachment.fileType} · {attachment.fileSizeLabel}</p>
                      <p className="mt-1 text-[10px] text-emerald-900/55 dark:text-emerald-200/50">{attachment.viewCount ?? 0} views · {attachment.downloadCount} downloads</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      aria-label={`Remove ${attachment.fileName}`}
                      disabled={uploadTasks.length > 0}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-wait disabled:opacity-50 dark:text-emerald-300/70 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-emerald-50 pt-2 dark:border-emerald-900/50">
                    <button type="button" onClick={() => setPreviewAttachment(attachment)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-950/40">
                      <Eye className="h-3 w-3" />Preview
                    </button>
                    {attachment.dataUrl && (
                      <>
                        <a href={attachment.dataUrl} download={attachment.fileName} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-950/40">
                          <Download className="h-3 w-3" />Download
                        </a>
                        <a href={attachment.dataUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-950/40">
                          <ExternalLink className="h-3 w-3" />Open
                        </a>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="border-t border-emerald-100 pt-3 dark:border-emerald-800/60">
        <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">Attachment delivery</p>
        <p className="mt-1 text-[11px] leading-5 text-emerald-900/60 dark:text-emerald-200/55">Choices apply when the matching notice delivery channel is enabled.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {distributionChannels.map(({ key, channel, label }) => (
            <label key={key} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-4 ${
              channels.includes(channel)
                ? 'border-emerald-100 bg-emerald-50/40 text-emerald-900 dark:border-emerald-900/60 dark:bg-[#041811] dark:text-emerald-200'
                : 'border-slate-100 bg-slate-50 text-slate-400 dark:border-emerald-950 dark:bg-[#03140E] dark:text-emerald-200/35'
            }`}>
              <input
                type="checkbox"
                checked={deliveryOptions[key]}
                disabled={!channels.includes(channel)}
                onChange={(event) => updateDeliveryOption(key, event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-emerald-700"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2.5 text-[10px] leading-4 text-amber-900/80 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200/70">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Files are checked locally for allowed extensions, declared types, and basic format signatures. Antivirus scanning and secure hosted links require a server-side upload service.
      </p>

      <Modal
        open={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
        title={previewAttachment?.fileName ?? 'Attachment preview'}
        subtitle={previewAttachment ? `${previewAttachment.fileType} · ${previewAttachment.fileSizeLabel}` : undefined}
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <button type="button" onClick={() => setPreviewAttachment(null)} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E]">
              Close
            </button>
            {previewAttachment?.dataUrl && (
              <a href={previewAttachment.dataUrl} download={previewAttachment.fileName} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500">
                <Download className="h-3.5 w-3.5" />Download file
              </a>
            )}
          </>
        }
      >
        {previewAttachment?.fileType === 'Image' && previewAttachment.dataUrl ? (
          <img src={previewAttachment.dataUrl} alt={previewAttachment.fileName} className="mx-auto max-h-[60vh] max-w-full rounded-lg object-contain" />
        ) : previewAttachment?.fileType === 'PDF' && previewAttachment.dataUrl ? (
          <iframe title={`Preview of ${previewAttachment.fileName}`} src={previewAttachment.dataUrl} className="h-[60vh] w-full rounded-lg border border-emerald-200 dark:border-emerald-800" />
        ) : previewAttachment?.dataUrl && previewAttachment.mimeType === 'text/plain' ? (
          <iframe title={`Preview of ${previewAttachment.fileName}`} src={previewAttachment.dataUrl} className="h-[60vh] w-full rounded-lg border border-emerald-200 bg-white dark:border-emerald-800" />
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <FileText className="h-10 w-10 text-emerald-700 dark:text-emerald-300" />
            <p className="max-w-md text-sm text-emerald-900/70 dark:text-emerald-200/65">
              {previewAttachment?.dataUrl
                ? 'A browser preview is not available for this file type. Download it or open it with a compatible application.'
                : 'This existing attachment is a sample resource without a local file preview.'}
            </p>
            {previewAttachment?.dataUrl && (
              <a href={previewAttachment.dataUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-100 dark:hover:bg-emerald-950/40">
                <ExternalLink className="h-3.5 w-3.5" />Open attachment
              </a>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
