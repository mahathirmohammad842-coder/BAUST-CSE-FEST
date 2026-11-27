import { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  UserX,
  X,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import type {
  RegistrationRequest,
  RegistrationStatus,
} from '../types';

type RequestFilter = 'All' | RegistrationStatus;

interface UserApprovalsPageProps {
  requests: RegistrationRequest[];
  existingAccountCount: number;
  onUpdateStatus: (
    requestId: string,
    status: 'Approved' | 'Rejected'
  ) => void;
}

function formatRegistrationDate(value: string) {
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(value));
}

function statusStyle(status: RegistrationStatus) {
  if (status === 'Approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  if (status === 'Rejected') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300';
}

export function UserApprovalsPage({
  requests,
  existingAccountCount,
  onUpdateStatus,
}: UserApprovalsPageProps) {
  const [filter, setFilter] = useState<RequestFilter>('All');
  const [selectedRequest, setSelectedRequest] =
    useState<RegistrationRequest | null>(null);

  const counts = useMemo(
    () => ({
      total: existingAccountCount + requests.length,
      pending: requests.filter((request) => request.status === 'Pending Approval')
        .length,
      approved:
        existingAccountCount +
        requests.filter((request) => request.status === 'Approved').length,
      rejected: requests.filter((request) => request.status === 'Rejected')
        .length,
    }),
    [existingAccountCount, requests]
  );
  const visibleRequests = useMemo(
    () =>
      requests
        .filter((request) => filter === 'All' || request.status === filter)
        .sort(
          (left, right) =>
            new Date(right.registeredAt).getTime() -
            new Date(left.registeredAt).getTime()
        ),
    [filter, requests]
  );

  const review = (request: RegistrationRequest, status: 'Approved' | 'Rejected') => {
    onUpdateStatus(request.id, status);
    setSelectedRequest(null);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
              User Approval Requests
            </h1>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Review new registrations before granting access to the fest portal.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          Organizer or Super Admin review
        </span>
      </header>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="User approval statistics"
      >
        <StatCard
          label="Total Users"
          value={counts.total.toLocaleString()}
          sublabel="Existing and registered accounts"
          icon={UserRound}
        />
        <StatCard
          label="Pending Requests"
          value={counts.pending.toLocaleString()}
          sublabel="Awaiting organizer review"
          icon={Clock3}
          tone="amber"
        />
        <StatCard
          label="Approved Users"
          value={counts.approved.toLocaleString()}
          sublabel="Active accounts"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Rejected Users"
          value={counts.rejected.toLocaleString()}
          sublabel="Inactive accounts"
          icon={UserX}
          tone="danger"
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 border-b border-emerald-100 px-4 py-4 dark:border-emerald-800/60 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
              Registration requests
            </h2>
            <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
              Review applicant details and update account status.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-1 rounded-lg bg-emerald-50 p-1 dark:bg-emerald-950/40"
            role="group"
            aria-label="Filter registration requests"
          >
            {(['All', 'Pending Approval', 'Approved', 'Rejected'] as const).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  aria-pressed={filter === option}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    filter === option
                      ? 'bg-white text-emerald-900 shadow-sm dark:bg-emerald-800 dark:text-white'
                      : 'text-emerald-800/70 hover:text-emerald-950 dark:text-emerald-200/70 dark:hover:text-white'
                  }`}
                >
                  {option === 'Pending Approval' ? 'Pending' : option}
                </button>
              )
            )}
          </div>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
              {filter === 'All' ? 'No registration requests yet' : `No ${filter.toLowerCase()} requests`}
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-emerald-900/60 dark:text-emerald-300/65">
              New account requests will appear here with their requested role and registration details.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                <tr>
                  <th className="px-4 py-3">Full name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Mobile number</th>
                  <th className="px-4 py-3">Requested role</th>
                  <th className="px-4 py-3">Department / organization</th>
                  <th className="px-4 py-3">Registration date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                {visibleRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="text-xs text-emerald-950 dark:text-emerald-50"
                  >
                    <td className="px-4 py-3.5 font-semibold">{request.fullName}</td>
                    <td className="px-4 py-3.5 text-emerald-900/75 dark:text-emerald-200/75">
                      {request.email}
                    </td>
                    <td className="px-4 py-3.5">{request.phone}</td>
                    <td className="px-4 py-3.5">{request.role}</td>
                    <td className="px-4 py-3.5">{request.affiliation}</td>
                    <td className="px-4 py-3.5 text-emerald-900/65 dark:text-emerald-300/70">
                      {formatRegistrationDate(request.registeredAt)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyle(request.status)}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(request)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Details
                        </button>
                        {request.status === 'Pending Approval' && (
                          <>
                            <button
                              type="button"
                              onClick={() => review(request, 'Approved')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => review(request, 'Rejected')}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={selectedRequest !== null}
        onClose={() => setSelectedRequest(null)}
        title="Registration details"
        subtitle="Review the applicant information and approval status."
        footer={
          selectedRequest?.status === 'Pending Approval' ? (
            <>
              <button
                type="button"
                onClick={() => selectedRequest && review(selectedRequest, 'Rejected')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </button>
              <button
                type="button"
                onClick={() => selectedRequest && review(selectedRequest, 'Approved')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600"
              >
                <Check className="h-3.5 w-3.5" />
                Approve User
              </button>
            </>
          ) : undefined
        }
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold">{selectedRequest.fullName}</p>
                <p className="mt-0.5 text-xs text-emerald-900/65 dark:text-emerald-200/70">
                  Requested access as {selectedRequest.role}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail icon={Mail} label="Email" value={selectedRequest.email} />
              <Detail icon={Phone} label="Mobile number" value={selectedRequest.phone} />
              <Detail icon={Building2} label="Department / organization" value={selectedRequest.affiliation} />
              <Detail icon={Clock3} label="Registration date" value={formatRegistrationDate(selectedRequest.registeredAt)} />
            </div>
            <div className="flex items-center justify-between border-t border-emerald-100 pt-3 dark:border-emerald-800/60">
              <span className="text-xs font-medium text-emerald-900/65 dark:text-emerald-200/70">
                Account status
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle(selectedRequest.status)}`}>
                {selectedRequest.status}
              </span>
            </div>
            {selectedRequest.reviewedAt && (
              <p className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                Reviewed {formatRegistrationDate(selectedRequest.reviewedAt)}. The applicant will see the decision when they next sign in.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1.5 break-words text-xs font-medium text-emerald-950 dark:text-emerald-50">
        {value}
      </p>
    </div>
  );
}
