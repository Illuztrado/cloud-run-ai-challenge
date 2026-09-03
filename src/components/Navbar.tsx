import React from 'react';
import { Sparkles, Plus, LogOut, Shield, User as UserIcon, CheckCircle2, Clock } from 'lucide-react';
import { User } from 'firebase/auth';

interface NavbarProps {
  user: User;
  onNewEntry: () => void;
  onSignOut: () => void;
  isSaving: boolean;
  activeEntryTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onNewEntry,
  onSignOut,
  isSaving,
  activeEntryTitle,
}) => {
  return (
    <header id="app-navbar" className="h-16 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Active Context */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/10 flex-shrink-0">
          <Sparkles className="w-4 h-4 text-neutral-950" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-neutral-100 hidden sm:inline">Gemini Reflection</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1 font-mono">
              <Shield className="w-3 h-3" />
              <span>Isolated</span>
            </span>
          </div>
          {activeEntryTitle && (
            <span className="text-xs text-neutral-400 truncate max-w-[200px] sm:max-w-xs font-mono">
              {activeEntryTitle}
            </span>
          )}
        </div>
      </div>

      {/* Center status */}
      <div className="hidden md:flex items-center gap-2 text-xs text-neutral-400">
        {isSaving ? (
          <span className="flex items-center gap-1.5 text-amber-400 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Saving to Firestore...
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-neutral-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Synced to Firestore
          </span>
        )}
      </div>

      {/* Actions & User Profile */}
      <div className="flex items-center gap-3">
        <button
          id="new-entry-button"
          onClick={onNewEntry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 transition active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Reflection</span>
        </button>

        <div className="h-6 w-px bg-neutral-800 mx-1" />

        {/* User Info */}
        <div className="flex items-center gap-2.5">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-8 h-8 rounded-full border border-neutral-700 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300">
              <UserIcon className="w-4 h-4" />
            </div>
          )}

          <div className="hidden lg:flex flex-col text-left">
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
            className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
