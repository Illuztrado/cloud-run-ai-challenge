import React from 'react';
import { User } from 'firebase/auth';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { ShieldAlert, ArrowLeft, RefreshCw, Lock } from 'lucide-react';

interface AdminGuardProps {
  user: User;
  onBackToJournal: () => void;
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ user, onBackToJournal, children }) => {
  const { isAdmin, isCheckingClaims, refreshClaims, error } = useAdminAuth(user);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  if (isCheckingClaims) {
    return (
      <div id="admin-guard-loading" className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 bg-neutral-950">
        <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 mb-4 animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-neutral-300">Evaluating cryptographic access claims...</p>
        <p className="text-xs text-neutral-500 mt-1">Verifying Firebase Auth JWT & custom claims</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div id="admin-guard-forbidden" className="flex-1 flex flex-col items-center justify-center p-6 bg-neutral-950 text-neutral-200">
        <div className="max-w-md w-full bg-neutral-900 border border-red-900/50 rounded-2xl p-6 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-800/80 flex items-center justify-center text-red-400 mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-lg font-semibold text-neutral-100 mb-2">
            Elevated Privileges Required
          </h2>

          <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
            The requested administrative resource requires an active <code className="text-amber-400 font-mono text-xs px-1.5 py-0.5 rounded bg-neutral-800">role: admin</code> custom claim or platform owner authorization.
          </p>

          <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-3 text-left mb-5 font-mono text-xs text-neutral-400 space-y-1">
            <div><span className="text-neutral-500">Authenticated Account:</span> {user.email || user.uid}</div>
            <div><span className="text-neutral-500">Status:</span> <span className="text-red-400">403 Forbidden</span></div>
            <div><span className="text-neutral-500">RBAC Policy:</span> Zero Insecure Defaults</div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 p-2.5 rounded-lg mb-4 text-left">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              id="admin-guard-return-button"
              onClick={onBackToJournal}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Reflections</span>
            </button>

            <button
              id="admin-guard-retry-button"
              onClick={async () => {
                setIsRefreshing(true);
                await refreshClaims(true);
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-medium transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Force Refresh Token</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
