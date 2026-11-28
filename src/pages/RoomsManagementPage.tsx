import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  DoorOpen,
  Edit3,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import type { RoomRecord } from '../types';

interface RoomsManagementPageProps {
  rooms: RoomRecord[];
  onUpsertRoom: (params: {
    id?: string | null;
    name: string;
    building: string;
    capacity: number | null;
    isActive: boolean;
  }) => Promise<string | null>;
  onToggleRoomActive: (roomId: string, isActive: boolean) => Promise<string | null>;
  onDeleteRoom: (roomId: string) => Promise<string | null>;
}

export function RoomsManagementPage({
  rooms,
  onUpsertRoom,
  onToggleRoomActive,
  onDeleteRoom,
}: RoomsManagementPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRecord | null>(null);
  const [name, setName] = useState('');
  const [building, setBuilding] = useState('');
  const [capacityText, setCapacityText] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoomRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const active = rooms.filter((r) => r.isActive);
    const totalCapacity = active.reduce((sum, r) => sum + (r.capacity ?? 0), 0);
    return {
      total: rooms.length,
      activeCount: active.length,
      disabledCount: rooms.length - active.length,
      totalCapacity,
    };
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rooms.filter((r) => {
      if (statusFilter === 'active' && !r.isActive) return false;
      if (statusFilter === 'disabled' && r.isActive) return false;
      if (!q) return true;
      return `${r.name} ${r.building}`.toLowerCase().includes(q);
    });
  }, [rooms, searchQuery, statusFilter]);

  const openCreateModal = () => {
    setEditingRoom(null);
    setName('');
    setBuilding('');
    setCapacityText('');
    setIsActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (room: RoomRecord) => {
    setEditingRoom(room);
    setName(room.name);
    setBuilding(room.building);
    setCapacityText(room.capacity !== null ? String(room.capacity) : '');
    setIsActive(room.isActive);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Room name is required.');
      return;
    }
    const parsedCap =
      capacityText.trim() === '' ? null : Number.parseInt(capacityText.trim(), 10);
    if (parsedCap !== null && (Number.isNaN(parsedCap) || parsedCap < 0)) {
      setFormError('Capacity must be a valid non-negative integer.');
      return;
    }

    setSaving(true);
    setFormError(null);
    const err = await onUpsertRoom({
      id: editingRoom?.id ?? null,
      name: cleanName,
      building: building.trim(),
      capacity: parsedCap,
      isActive,
    });
    setSaving(false);
    if (err) {
      setFormError(err);
      return;
    }
    setModalOpen(false);
  };

  const handleToggle = async (room: RoomRecord) => {
    setBusyId(room.id);
    await onToggleRoomActive(room.id, !room.isActive);
    setBusyId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    const err = await onDeleteRoom(deleteTarget.id);
    setBusyId(null);
    if (!err) {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-emerald-950 dark:text-emerald-50">
            Rooms &amp; Venues Management
          </h1>
          <p className="mt-1 text-sm text-emerald-900/65 dark:text-emerald-200/70">
            Super Admin directory for campus rooms, labs, and halls synced live into notice targeting and incident reports.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#064E3B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#053D2E] dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Room / Venue
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Venues"
          value={metrics.total.toLocaleString()}
          sublabel="Configured campus rooms"
          icon={DoorOpen}
        />
        <StatCard
          label="Active Venues"
          value={metrics.activeCount.toLocaleString()}
          sublabel="Available in Create Notice & Reports"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Disabled Venues"
          value={metrics.disabledCount.toLocaleString()}
          sublabel="Hidden from new notices"
          icon={Power}
          tone="amber"
        />
        <StatCard
          label="Active Seat Capacity"
          value={metrics.totalCapacity.toLocaleString()}
          sublabel="Combined venue capacity"
          icon={Users}
        />
      </div>

      <section className="rounded-xl border border-emerald-200/80 bg-white shadow-sm dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 border-b border-emerald-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/60">
          <div className="relative w-full sm:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700/50 dark:text-emerald-300/50"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search room or building..."
              className="w-full rounded-lg border border-emerald-200/80 bg-white py-2 pl-9 pr-3 text-sm text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45"
            />
          </div>

          <div className="inline-flex rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-0.5 dark:border-emerald-800/70 dark:bg-[#041811]">
            {(['all', 'active', 'disabled'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  statusFilter === tab
                    ? 'bg-[#064E3B] text-white dark:bg-emerald-600'
                    : 'text-emerald-900/70 hover:text-emerald-950 dark:text-emerald-200/70 dark:hover:text-emerald-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredRooms.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Building2}
              title="No matching rooms found"
              description="Add a new campus room or adjust your search filter."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/40 text-xs font-semibold uppercase tracking-wider text-emerald-900/60 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-200/60">
                  <th className="px-5 py-3">Room / Venue Name</th>
                  <th className="px-4 py-3">Building</th>
                  <th className="px-4 py-3 text-right">Capacity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-800/50">
                {filteredRooms.map((room) => (
                  <tr
                    key={room.id}
                    className="transition-colors hover:bg-emerald-50/35 dark:hover:bg-emerald-900/15"
                  >
                    <td className="px-5 py-3.5 font-semibold text-emerald-950 dark:text-emerald-50">
                      {room.name}
                    </td>
                    <td className="px-4 py-3.5 text-emerald-900/75 dark:text-emerald-200/75">
                      {room.building || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-emerald-900 dark:text-emerald-100">
                      {room.capacity !== null ? room.capacity : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          room.isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            room.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {room.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === room.id}
                          onClick={() => openEditModal(room)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busyId === room.id}
                          onClick={() => void handleToggle(room)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]"
                        >
                          <Power className="h-3.5 w-3.5" aria-hidden="true" />
                          {room.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === room.id}
                          onClick={() => setDeleteTarget(room)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:bg-[#041811] dark:text-red-300 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Delete
                        </button>
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
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingRoom ? 'Edit Room / Venue' : 'Add New Room / Venue'}
        subtitle="Changes automatically update Composer room targeting, Analytics, and Incident Reports."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {formError}
            </div>
          )}

          <div>
            <label
              htmlFor="room-name"
              className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100"
            >
              Room / Venue Name
            </label>
            <input
              id="room-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CSE Lab 1 (PC-01 to PC-45)"
              className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="room-building"
                className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100"
              >
                Building / Zone
              </label>
              <input
                id="room-building"
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="e.g., CSE Wing"
                className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </div>
            <div>
              <label
                htmlFor="room-capacity"
                className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100"
              >
                Capacity (Seats)
              </label>
              <input
                id="room-capacity"
                type="number"
                min={0}
                value={capacityText}
                onChange={(e) => setCapacityText(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm font-medium text-emerald-950 dark:text-emerald-100">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
            />
            Active (selectable in Create Notice and Incident Reports)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#053D2E] disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {saving ? 'Saving...' : editingRoom ? 'Save Changes' : 'Create Room'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => !busyId && setDeleteTarget(null)}
        title="Delete Room?"
        subtitle="Existing historical announcements referencing this room name will keep their label."
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => void handleConfirmDelete()}
              className="rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60 dark:bg-red-600 dark:hover:bg-red-500"
            >
              {busyId ? 'Deleting...' : 'Delete Room'}
            </button>
          </>
        }
      >
        <p className="text-sm text-emerald-900/80 dark:text-emerald-100/80">
          Are you sure you want to delete{' '}
          <strong className="text-emerald-950 dark:text-emerald-50">
            {deleteTarget?.name}
          </strong>
          ?
        </p>
      </Modal>
    </div>
  );
}
