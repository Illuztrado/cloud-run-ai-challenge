import React, { useState } from 'react';
import {
  Car,
  Plus,
  Trash2,
  MapPin,
  Clock,
  Search,
  ChevronRight,
  ShieldCheck,
  Receipt,
  MessageSquare,
  X,
} from 'lucide-react';
import { RideEntry, RideHailingApp } from '../types';

interface RideHistorySidebarProps {
  rides: RideEntry[];
  selectedRideId: string | null;
  onSelectRide: (rideId: string) => void;
  onNewRide: () => void;
  onDeleteRide: (rideId: string) => void;
  onClose?: () => void;
}

const BADGES: Record<RideHailingApp, { bg: string; text: string; border: string }> = {
  Grab: { bg: 'bg-emerald-950/70', text: 'text-emerald-300', border: 'border-emerald-700/60' },
  Angkas: { bg: 'bg-blue-950/70', text: 'text-blue-300', border: 'border-blue-700/60' },
  JoyRide: { bg: 'bg-cyan-950/70', text: 'text-cyan-300', border: 'border-cyan-700/60' },
  'Move It': { bg: 'bg-rose-950/70', text: 'text-rose-300', border: 'border-rose-700/60' },
  InDrive: { bg: 'bg-teal-950/70', text: 'text-teal-300', border: 'border-teal-700/60' },
  Taxi: { bg: 'bg-amber-950/70', text: 'text-amber-300', border: 'border-amber-700/60' },
  Other: { bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-neutral-700' },
};

export const RideHistorySidebar: React.FC<RideHistorySidebarProps> = ({
  rides,
  selectedRideId,
  onSelectRide,
  onNewRide,
  onDeleteRide,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredRides = rides.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.rideService && r.rideService.toLowerCase().includes(q)) ||
      (r.pickupAddress && r.pickupAddress.toLowerCase().includes(q)) ||
      (r.destinationAddress && r.destinationAddress.toLowerCase().includes(q)) ||
      (r.reviewText && r.reviewText.toLowerCase().includes(q))
    );
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this ride entry from your private history?')) {
      onDeleteRide(id);
    }
  };

  return (
    <aside className="w-full md:w-80 h-full border-r border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-neutral-800/80 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
            <Car className="w-4 h-4 text-amber-400" />
            My Private Rides
          </h3>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
            <ShieldCheck className="w-3 h-3" /> User ({rides.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onNewRide}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold transition shadow-sm min-h-[40px]"
            title="Log a new ride"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-neutral-800 text-neutral-400 hover:text-neutral-100 transition"
              title="Close history drawer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-neutral-800/60">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search past rides..."
            className="w-full pl-8 pr-2 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Ride History List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredRides.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-500">
            {search ? 'No matching rides found.' : 'No ride entries logged yet. Click "+ New" to log your first trip!'}
          </div>
        ) : (
          filteredRides.map((r) => {
            const isSelected = r.id === selectedRideId;
            const badge = BADGES[r.rideService as RideHailingApp] || BADGES.Other;

            return (
              <div
                key={r.id}
                onClick={() => onSelectRide(r.id)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition relative group ${
                  isSelected
                    ? 'bg-neutral-800/90 border-amber-400/60 ring-1 ring-amber-400/30'
                    : 'bg-neutral-900/40 border-neutral-800 hover:bg-neutral-800/50 hover:border-neutral-700'
                }`}
              >
                {/* Top: Service & Fare */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    {r.rideService}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-amber-400">
                      {r.farePaid ? `₱${r.farePaid}` : '—'}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, r.id)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 min-h-[36px] min-w-[36px] flex items-center justify-center p-1.5 text-neutral-400 hover:text-red-400 rounded-lg transition"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Route */}
                <div className="text-xs text-neutral-300 font-medium line-clamp-1 mb-1">
                  {r.pickupAddress || 'Unset Pickup'} → {r.destinationAddress || 'Unset Dropoff'}
                </div>

                {/* Duration & Review status */}
                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <div className="flex items-center gap-2">
                    {r.tripDuration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {r.tripDuration}
                      </span>
                    )}
                    {r.receiptImage && (
                      <span className="flex items-center gap-0.5 text-neutral-400">
                        <Receipt className="w-2.5 h-2.5" /> Receipt
                      </span>
                    )}
                  </div>
                  <span>
                    {new Date(r.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
