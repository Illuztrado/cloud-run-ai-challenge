import React from 'react';
import {
  Car,
  Users,
  Shield,
  Plus,
  LogOut,
  User as UserIcon,
  CheckCircle2,
  Clock,
  Settings,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { useAdminAuth } from '../hooks/useAdminAuth';

export type DashboardView = 'private' | 'community' | 'admin';

interface NavbarProps {
  user: User;
  currentView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  onNewRide: () => void;
  onSignOut: () => void;
  isSaving: boolean;
  activeFare?: number;
  activeService?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentView,
  onSelectView,
  onNewRide,
  onSignOut,
  isSaving,
  activeFare,
  activeService,
}) => {
  const { isAdmin } = useAdminAuth(user);

  return (
    <header id="app-navbar" className="h-16 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Context */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/10 flex-shrink-0">
          <Car className="w-5 h-5 sm:w-4 sm:h-4 text-neutral-950" />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold text-xs sm:text-sm text-neutral-100 truncate"> Ride Monitor</span>
            <span className="text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 flex items-center gap-1 font-mono flex-shrink-0">
              <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>User</span>
            </span>
            {isAdmin && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/80 font-mono hidden md:inline-flex items-center gap-1 flex-shrink-0">
                <Shield className="w-2.5 h-2.5" />
                <span>Admin</span>
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] text-neutral-400 truncate max-w-[170px] sm:max-w-[220px]">
            {currentView === 'private' && (activeService && activeFare ? `${activeService} • ₱${activeFare}` : 'Private Trip Dashboard')}
            {currentView === 'community' && 'Community Board & Trends'}
            {currentView === 'admin' && 'Admin Control Console'}
          </span>
        </div>
      </div>

      {/* Desktop Center Navigation Tabs (hidden on mobile; mobile uses bottom navigation bar) */}
      <div className="hidden md:flex items-center p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
        <button
          id="nav-private-tab"
          onClick={() => onSelectView('private')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition min-h-[36px] ${
            currentView === 'private'
              ? 'bg-amber-400 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>My Rides & AI Advisor</span>
        </button>

        <button
          id="nav-community-tab"
          onClick={() => onSelectView('community')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition min-h-[36px] ${
            currentView === 'community'
              ? 'bg-amber-400 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Community Board</span>
        </button>

        {isAdmin && (
          <button
            id="nav-admin-tab"
            onClick={() => onSelectView('admin')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition min-h-[36px] ${
              currentView === 'admin'
                ? 'bg-amber-400 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Admin Console</span>
          </button>
        )}
      </div>

      {/* Right Actions & User Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {currentView === 'private' && (
          <button
            id="navbar-new-ride-button"
            onClick={onNewRide}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-neutral-100 hover:bg-white text-neutral-950 transition active:scale-95 shadow-sm min-h-[44px]"
            title="Log a new ride"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Ride</span>
          </button>
        )}

        <div className="h-6 w-px bg-neutral-800 mx-0.5 sm:mx-1" />

        {/* User Info & Sign Out with 44px touch targets */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-9 h-9 rounded-full border border-neutral-700 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300">
              <UserIcon className="w-4 h-4" />
            </div>
          )}

          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-medium text-neutral-200 truncate max-w-[120px]">
              {user.displayName || user.email?.split('@')[0]}
            </span>
            <span className="text-[10px] text-neutral-500 truncate max-w-[120px]">
              {user.email}
            </span>
          </div>

          <button
            id="sign-out-button"
            onClick={onSignOut}
            title="Sign Out"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-xl transition active:scale-95"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
