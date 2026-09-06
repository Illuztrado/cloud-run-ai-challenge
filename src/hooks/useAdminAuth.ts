import { useState, useEffect, useCallback } from 'react';
import { User, IdTokenResult } from 'firebase/auth';
import { UserRole } from '../types';

const BOOTSTRAP_ADMIN_EMAIL = 'canindojp@gmail.com';

interface AdminAuthState {
  isAdmin: boolean;
  role: UserRole;
  isCheckingClaims: boolean;
  error: string | null;
  refreshClaims: (forceServerRefresh?: boolean) => Promise<boolean>;
}

export function useAdminAuth(user: User | null): AdminAuthState {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [role, setRole] = useState<UserRole>('user');
  const [isCheckingClaims, setIsCheckingClaims] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const evaluateClaims = useCallback(
    async (forceRefresh = false): Promise<boolean> => {
      if (!user) {
        setIsAdmin(false);
        setRole('user');
        setIsCheckingClaims(false);
        return false;
      }

      try {
        setIsCheckingClaims(true);
        setError(null);

        // Retrieve token result with optional forced refresh to bypass 60m JWT cache
        const tokenResult: IdTokenResult = await user.getIdTokenResult(forceRefresh);
        const claimRole = (tokenResult.claims.role as UserRole) || 'user';
        const isOwner = user.email === BOOTSTRAP_ADMIN_EMAIL;

        if (claimRole === 'admin' || isOwner) {
          setIsAdmin(true);
          setRole('admin');

          // If project owner doesn't have the custom claim yet, bootstrap it server-side
          if (isOwner && tokenResult.claims.role !== 'admin') {
            try {
              const token = await user.getIdToken();
              const response = await fetch('/api/admin/bootstrap', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              if (response.ok) {
                // Force token refresh after backend assignment
                await user.getIdToken(true);
              }
            } catch (bootstrapErr) {
              console.warn('Bootstrap claim assignment deferred:', bootstrapErr);
            }
          }

          setIsCheckingClaims(false);
          return true;
        } else if (claimRole === 'moderator') {
          setIsAdmin(false);
          setRole('moderator');
          setIsCheckingClaims(false);
          return false;
        } else {
          setIsAdmin(false);
          setRole('user');
          setIsCheckingClaims(false);
          return false;
        }
      } catch (err: any) {
        console.error('Error verifying admin claims:', err);
        setError(err.message || 'Failed to verify administrative authorization.');
        setIsAdmin(user.email === BOOTSTRAP_ADMIN_EMAIL);
        setIsCheckingClaims(false);
        return user.email === BOOTSTRAP_ADMIN_EMAIL;
      }
    },
    [user]
  );

  useEffect(() => {
    evaluateClaims(false);
  }, [evaluateClaims]);

  const refreshClaims = useCallback(
    async (forceServerRefresh = true): Promise<boolean> => {
      return evaluateClaims(forceServerRefresh);
    },
    [evaluateClaims]
  );

  return {
    isAdmin,
    role,
    isCheckingClaims,
    error,
    refreshClaims,
  };
}
