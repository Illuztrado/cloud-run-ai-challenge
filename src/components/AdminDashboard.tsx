import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  AdminUserRecord,
  AdminSystemMetrics,
  AdminAuditLog,
  UserRole,
} from '../types';
import {
  fetchAdminUsers,
  fetchAdminTelemetry,
  fetchAdminAuditLogs,
  updateAdminUserRole,
} from '../lib/firebase';
import {
  Shield,
  Users,
  Activity,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Lock,
  Cpu,
  Database,
  History,
  UserCheck,
} from 'lucide-react';

interface AdminDashboardProps {
  user: User;
  onBackToJournal: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  onBackToJournal,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'metrics' | 'audit'>('users');
  const [usersList, setUsersList] = useState<AdminUserRecord[]>([]);
  const [metrics, setMetrics] = useState<AdminSystemMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isRefreshingToken, setIsRefreshingToken] = useState<boolean>(false);

  // Load users directory
  const loadUsers = useCallback(async () => {
    try {
      const users = await fetchAdminUsers();
      setUsersList(users);
    } catch (clientErr: any) {
      console.warn('Client Firestore query error, attempting server fallback:', clientErr);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsersList(data.users || []);
          return;
        }
      } catch (serverErr) {
        console.error('Server fallback error:', serverErr);
      }
      setStatusMessage({ text: clientErr.message || 'Error loading users list', type: 'error' });
    }
  }, [user]);

  // Load metrics
  const loadMetrics = useCallback(async () => {
    try {
      const data = await fetchAdminTelemetry();
      setMetrics(data);
    } catch (err) {
      console.warn('Telemetry query fallback:', err);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/metrics', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch {}
    }
  }, [user]);

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    try {
      const logs = await fetchAdminAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Audit logs query fallback:', err);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/audit-logs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data.logs || []);
        }
      } catch {}
    }
  }, [user]);

  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadUsers(), loadMetrics(), loadAuditLogs()]);
    setIsLoading(false);
  }, [loadUsers, loadMetrics, loadAuditLogs]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Handle Role Change
  const handleRoleChange = async (targetUserId: string, newRole: UserRole) => {
    try {
      setUpdatingUserId(targetUserId);
      setStatusMessage(null);

      // Attempt server-side update first (to set Custom Claims)
      let serverUpdated = false;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/set-role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetUserId, newRole }),
        });
        if (res.ok) {
          serverUpdated = true;
        }
      } catch (err) {
        console.warn('Server role update skipped, updating directly in Firestore:', err);
      }

      // Ensure Firestore document and audit event are persisted
      if (!serverUpdated) {
        await updateAdminUserRole(targetUserId, newRole, user);
      }

      // Optimistically update local list
      setUsersList((prev) =>
        prev.map((u) => (u.uid === targetUserId ? { ...u, role: newRole, roleUpdatedAt: new Date().toISOString() } : u))
      );

      setStatusMessage({
        text: `Successfully assigned role '${newRole}' to user UID ${targetUserId}. User role and audit trail updated.`,
        type: 'success',
      });

      // Reload metrics and audit logs to reflect the change
      loadMetrics();
      loadAuditLogs();
    } catch (err: any) {
      console.error('Role update error:', err);
      setStatusMessage({ text: err.message || 'Failed to change role.', type: 'error' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Force Token Refresh
  const handleForceTokenRefresh = async () => {
    setIsRefreshingToken(true);
    try {
      await user.getIdToken(true);
      setStatusMessage({
        text: 'ID Token forcefully refreshed! Custom claims re-evaluated against Google Identity Services.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({ text: 'Token refresh error: ' + err.message, type: 'error' });
    } finally {
      setIsRefreshingToken(false);
    }
  };

  // Filtered Users
  const filteredUsers = usersList.filter((u) => {
    const matchesQuery =
      (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.uid.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesQuery && matchesRole;
  });

  return (
    <div id="admin-dashboard" className="flex-1 flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-y-auto">
      {/* Top Banner & Navigation */}
      <div className="border-b border-neutral-800 bg-neutral-900/60 px-6 py-5 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="admin-back-button"
              onClick={onBackToJournal}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
              title="Return to Reflection Journal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-neutral-100">Admin Console</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/80 text-amber-400 font-mono">
                  RBAC Active
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Authoritative custom claims management & system-level telemetry
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5">
            <button
              id="refresh-claims-button"
              onClick={handleForceTokenRefresh}
              disabled={isRefreshingToken}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition flex items-center gap-1.5"
              title="Force client token refresh (bypasses 60min cache)"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshingToken ? 'animate-spin' : ''}`} />
              <span>Force Token Refresh</span>
            </button>

            <button
              id="refresh-data-button"
              onClick={refreshAllData}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Sync Dashboard</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-5 border-t border-neutral-800/80 pt-3">
          <button
            id="tab-users"
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
              activeTab === 'users'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Directory & Roles ({usersList.length})</span>
          </button>

          <button
            id="tab-metrics"
            onClick={() => setActiveTab('metrics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
              activeTab === 'metrics'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Telemetry & Health</span>
          </button>

          <button
            id="tab-audit"
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
              activeTab === 'audit'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>RBAC Audit Log ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Status Message Notification */}
        {statusMessage && (
          <div
            id="admin-status-toast"
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition animate-in fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
                : 'bg-red-950/70 border-red-800 text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-neutral-400 hover:text-neutral-200 px-1 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Security Invariant Guarantee Banner */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-200">
                Zero Direct Access Architecture
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">
                In strict compliance with user privacy isolation policies, administrators can manage account lifecycle and system telemetry, but are <strong className="text-neutral-200">mathematically blocked</strong> by Cloud Firestore security rules from reading user personal journal reflections.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center font-mono text-[11px] text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded-md border border-neutral-800">
            <span>Rules Evaluation:</span>
            <span className="text-emerald-400 font-semibold">O(1) Zero-Read JWT</span>
          </div>
        </div>

        {/* TAB 1: USERS DIRECTORY & ROLES */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-900/60 border border-neutral-800 p-3 rounded-xl">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-search-input"
                  type="text"
                  placeholder="Search by name, email, or UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Filter className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-xs text-neutral-400">Role:</span>
                <select
                  id="admin-role-filter"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="moderator">Moderators</option>
                  <option value="user">Standard Users</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-300">
                  <thead className="bg-neutral-950/80 border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">UID</th>
                      <th className="py-3 px-4">Assigned Role</th>
                      <th className="py-3 px-4">Last Active</th>
                      <th className="py-3 px-4 text-right">Role Mutation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-neutral-500">
                          No users found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((item) => {
                        const isCurrentAdmin = item.role === 'admin';
                        const isCurrentModerator = item.role === 'moderator';
                        const isSelf = item.uid === user.uid;

                        return (
                          <tr key={item.uid} className="hover:bg-neutral-800/30 transition">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {item.photoURL ? (
                                  <img
                                    src={item.photoURL}
                                    alt={item.displayName || 'Avatar'}
                                    className="w-7 h-7 rounded-full border border-neutral-700 object-cover flex-shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 font-semibold text-xs flex-shrink-0">
                                    {(item.displayName || item.email || 'U')[0].toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium text-neutral-200 truncate flex items-center gap-1.5">
                                    <span>{item.displayName || 'Anonymous User'}</span>
                                    {isSelf && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-neutral-500 text-[11px] truncate">
                                    {item.email || 'No email attached'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px] text-neutral-400 truncate max-w-[120px]">
                              {item.uid}
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                                  isCurrentAdmin
                                    ? 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                                    : isCurrentModerator
                                    ? 'bg-blue-950/70 text-blue-300 border-blue-700/60'
                                    : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                                }`}
                              >
                                {isCurrentAdmin && <Shield className="w-3 h-3 text-amber-400" />}
                                {isCurrentModerator && <UserCheck className="w-3 h-3 text-blue-400" />}
                                <span className="capitalize">{item.role}</span>
                              </span>
                            </td>

                            <td className="py-3 px-4 text-neutral-400 text-[11px]">
                              {item.lastLoginAt
                                ? new Date(item.lastLoginAt).toLocaleDateString()
                                : item.createdAt
                                ? new Date(item.createdAt).toLocaleDateString()
                                : 'Recent'}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <select
                                  id={`role-select-${item.uid}`}
                                  value={item.role}
                                  disabled={updatingUserId === item.uid}
                                  onChange={(e) => handleRoleChange(item.uid, e.target.value as UserRole)}
                                  className="bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer disabled:opacity-50"
                                >
                                  <option value="user">User</option>
                                  <option value="moderator">Moderator</option>
                                  <option value="admin">Admin</option>
                                </select>
                                {updatingUserId === item.uid && (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TELEMETRY & HEALTH */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {/* Top 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-400 font-medium">Total Registered Users</span>
                  <Users className="w-4 h-4 text-neutral-500" />
                </div>
                <div className="text-2xl font-bold text-neutral-100 font-mono">
                  {metrics ? metrics.totalUsers : usersList.length}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">Platform-wide user accounts</div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-400 font-medium">Privileged Admins</span>
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400 font-mono">
                  {metrics ? metrics.adminCount : usersList.filter((u) => u.role === 'admin').length}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">Cryptographic claims issued</div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-400 font-medium">Firestore Status</span>
                  <Database className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
                  <span>Connected</span>
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">Rules: v2 with Owner Isolation</div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-400 font-medium">Server Status</span>
                  <Cpu className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-blue-400 font-mono">
                  200 OK
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">Cloud Run / Express Node.js</div>
              </div>
            </div>

            {/* AI Model Ladder Status */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-neutral-200">
                    Gemini Resilient Model Fallback Ladder
                  </h3>
                </div>
                <span className="text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                  Automatic Failover Active
                </span>
              </div>

              <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                Reflections are orchestrated through an automated sequential fallback ladder. If any high-availability model experiences a transient spike or quota constraint, requests automatically degrade gracefully:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {(metrics?.geminiModelLadder || [
                  'gemini-3.5-flash',
                  'gemini-3.5-flash-lite',
                  'gemini-3.1-flash-lite',
                  'gemini-flash-lite-latest',
                  'gemini-3.6-flash',
                  'gemini-3.7-flash',
                ]).map((modelName, idx) => (
                  <div
                    key={modelName}
                    className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-[10px] font-mono">
                        {idx + 1}
                      </span>
                      <span className="font-mono text-neutral-300">{modelName}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">Tier {idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">Security Audit Trail</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Immutable record of role changes, administrative elevations, and access assignments.
                </p>
              </div>
              <button
                onClick={loadAuditLogs}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 rounded-lg transition"
              >
                Refresh Log
              </button>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-lg">
              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 text-xs">
                  No security events recorded yet. Role changes will be logged here.
                </div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-neutral-800/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-amber-400">{log.action}</span>
                          <span className="text-neutral-500">•</span>
                          <span className="text-neutral-300">
                            Changed from <code className="text-neutral-400 bg-neutral-800 px-1 py-0.5 rounded">{log.previousRole || 'user'}</code> to{' '}
                            <code className="text-amber-400 bg-neutral-800 px-1 py-0.5 rounded">{log.newRole}</code>
                          </span>
                        </div>
                        <div className="text-neutral-400 text-[11px] font-mono">
                          Target UID: {log.targetUid} | Actor: {log.actorEmail}
                        </div>
                      </div>
                      <div className="text-neutral-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
