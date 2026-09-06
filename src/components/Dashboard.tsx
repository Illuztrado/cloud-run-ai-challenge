import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  saveRideEntry,
  deleteRideEntry,
  subscribeToUserRides,
  publishCommunityRide,
  subscribeToCommunityRides,
  seedInitialCommunityRidesIfEmpty,
  logOut,
} from '../lib/firebase';
import { RideEntry, CommunityRide, RideHailingApp } from '../types';
import { Navbar, DashboardView } from './Navbar';
import { RideWorkspace } from './RideWorkspace';
import { RideHistorySidebar } from './RideHistorySidebar';
import { CommunityBoard } from './CommunityBoard';
import { AdminDashboard } from './AdminDashboard';
import { AdminGuard } from './AdminGuard';
import { AlertCircle, Menu, X, Car, History, Users, Settings, Plus } from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface DashboardProps {
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const { isAdmin } = useAdminAuth(user);
  const [currentView, setCurrentView] = useState<DashboardView>('private');
  const [userRides, setUserRides] = useState<RideEntry[]>([]);
  const [communityRides, setCommunityRides] = useState<CommunityRide[]>([]);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Auto-save debounce timer ref
  const saveTimeoutRef = useRef<any>(null);

  // Factory function to generate a clean, blank ride entry
  const createNewRide = useCallback((): RideEntry => {
    const newId = 'ride_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    return {
      id: newId,
      userId: user.uid,
      rideService: 'Grab',
      farePaid: 0,
      pickupAddress: '',
      destinationAddress: '',
      tripDuration: '',
      tripDistance: '',
      reviewText: 'None',
      receiptImage: '',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }, [user.uid]);

  // Seed initial community data on first load if empty
  useEffect(() => {
    if (user) {
      seedInitialCommunityRidesIfEmpty(user);
    }
  }, [user]);

  // Subscribe to realtime updates for this user's isolated Firestore entries
  useEffect(() => {
    if (!user || !user.uid) return;

    const unsubscribe = subscribeToUserRides(
      user.uid,
      (rides) => {
        setUserRides(rides);
        setFirestoreError(null);

        // If no ride is currently selected or current selection was deleted
        setSelectedRideId((prevId) => {
          if (prevId && rides.some((r) => r.id === prevId)) {
            return prevId;
          }
          if (rides.length > 0) {
            return rides[0].id;
          }
          return null;
        });
      },
      (error) => {
        console.error('Firestore personal ride subscription error:', error);
        setFirestoreError('Failed to sync rides with Firestore. Please check connection.');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Subscribe to realtime crowdsourced community rides
  useEffect(() => {
    const unsubscribe = subscribeToCommunityRides(
      (rides) => {
        setCommunityRides(rides);
      },
      (error) => {
        console.error('Firestore community subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Derive active selected ride
  const activeRide: RideEntry = React.useMemo(() => {
    const found = userRides.find((r) => r.id === selectedRideId);
    if (found) return found;
    return createNewRide();
  }, [userRides, selectedRideId, createNewRide]);

  // Handle Updates to the active ride
  const handleUpdateActiveRide = (updates: Partial<RideEntry>) => {
    const updated: RideEntry = {
      ...activeRide,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Optimistically update local user rides state
    setUserRides((prev) => {
      const exists = prev.some((r) => r.id === updated.id);
      if (exists) {
        return prev.map((r) => (r.id === updated.id ? updated : r));
      } else {
        return [updated, ...prev];
      }
    });

    if (selectedRideId !== updated.id) {
      setSelectedRideId(updated.id);
    }

    // Debounce save to isolated user collection
    setIsSaving(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveRideEntry(user.uid, updated);
        setFirestoreError(null);
      } catch (err: any) {
        console.error('Error auto-saving ride to Firestore:', err);
        setFirestoreError(`Database save error: ${err.message || 'Could not persist ride.'}`);
      } finally {
        setIsSaving(false);
      }
    }, 600);
  };

  // Immediate Save handler
  const handleSaveToHistory = async (rideToSave: RideEntry) => {
    setIsSaving(true);
    try {
      await saveRideEntry(user.uid, rideToSave);
      setFirestoreError(null);
    } catch (err: any) {
      console.error('Save to history error:', err);
      setFirestoreError(`Failed to save: ${err.message}`);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // Publish to General Community Board
  const handlePublishToCommunity = async (communityRide: CommunityRide) => {
    try {
      await publishCommunityRide(communityRide);
    } catch (err: any) {
      console.error('Publish error:', err);
      throw err;
    }
  };

  // Handle Delete Ride from User History
  const handleDeleteRide = async (rideId: string) => {
    try {
      await deleteRideEntry(user.uid, rideId);
      setUserRides((prev) => prev.filter((r) => r.id !== rideId));
      if (selectedRideId === rideId) {
        setSelectedRideId(null);
      }
    } catch (err: any) {
      console.error('Delete ride error:', err);
      setFirestoreError(`Failed to delete ride: ${err.message}`);
    }
  };

  // Handle New Ride creation
  const handleNewRide = () => {
    const fresh = createNewRide();
    setUserRides((prev) => [fresh, ...prev]);
    setSelectedRideId(fresh.id);
    setCurrentView('private');
    setMobileSidebarOpen(false);
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-950 text-neutral-100 overflow-hidden selection:bg-amber-500/30">
      {/* Universal Top Navigation */}
      <Navbar
        user={user}
        currentView={currentView}
        onSelectView={(view) => {
          setCurrentView(view);
          setMobileSidebarOpen(false);
        }}
        onNewRide={handleNewRide}
        onSignOut={handleSignOut}
        isSaving={isSaving}
        activeFare={activeRide.farePaid}
        activeService={activeRide.rideService}
      />

      {/* Global Error Banner */}
      {firestoreError && (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 px-6 py-2 text-xs flex items-center justify-between z-20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{firestoreError}</span>
          </div>
          <button
            onClick={() => handleSaveToHistory(activeRide)}
            className="px-2.5 py-1 bg-red-900/90 hover:bg-red-800 text-red-100 rounded text-[11px] font-semibold"
          >
            Retry Save
          </button>
        </div>
      )}

      {/* Main View Area */}
      <div className="flex-1 flex min-h-0 relative pb-16 md:pb-0">
        {currentView === 'private' && (
          <>
            {/* Desktop Left Sidebar: Private Ride History */}
            <div className="hidden md:block h-full">
              <RideHistorySidebar
                rides={userRides}
                selectedRideId={selectedRideId}
                onSelectRide={(id) => setSelectedRideId(id)}
                onNewRide={handleNewRide}
                onDeleteRide={handleDeleteRide}
              />
            </div>

            {/* Mobile Slide-over Sidebar Drawer */}
            {mobileSidebarOpen && (
              <div className="md:hidden fixed inset-0 z-50 flex">
                <div
                  className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm"
                  onClick={() => setMobileSidebarOpen(false)}
                />
                <div className="relative w-80 max-w-[85vw] bg-neutral-900 h-full shadow-2xl z-50 flex flex-col">
                  <RideHistorySidebar
                    rides={userRides}
                    selectedRideId={selectedRideId}
                    onSelectRide={(id) => {
                      setSelectedRideId(id);
                      setMobileSidebarOpen(false);
                    }}
                    onNewRide={() => {
                      handleNewRide();
                      setMobileSidebarOpen(false);
                    }}
                    onDeleteRide={handleDeleteRide}
                    onClose={() => setMobileSidebarOpen(false)}
                  />
                </div>
              </div>
            )}

            {/* Center Content: Workspace (Form + Scanner + Multi-Turn Gemini Advisor) */}
            <RideWorkspace
              user={user}
              ride={activeRide}
              onUpdateRide={handleUpdateActiveRide}
              onSaveToHistory={handleSaveToHistory}
              onPublishToCommunity={handlePublishToCommunity}
              onDeleteRide={handleDeleteRide}
            />
          </>
        )}

        {currentView === 'community' && (
          <div className="flex-1 overflow-y-auto w-full">
            <CommunityBoard rides={communityRides} user={user} onSignedIn={() => {}} />
          </div>
        )}

        {currentView === 'admin' && (
          <div className="flex-1 overflow-y-auto w-full">
            <AdminGuard user={user} onBackToJournal={() => setCurrentView('private')}>
              <AdminDashboard user={user} onBackToJournal={() => setCurrentView('private')} />
            </AdminGuard>
          </div>
        )}
      </div>

      {/* Mobile-First Bottom Navigation Bar with 44px+ touch ergonomics */}
      <nav id="mobile-bottom-nav" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-800 px-3 py-1 flex items-center justify-around shadow-2xl safe-area-bottom">
        <button
          id="mobile-nav-workspace"
          onClick={() => {
            setCurrentView('private');
            setMobileSidebarOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[56px] px-2 py-1 rounded-xl transition active:scale-95 ${
            currentView === 'private' && !mobileSidebarOpen
              ? 'text-amber-400 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 font-medium'
          }`}
        >
          <Car className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Active Trip</span>
        </button>

        <button
          id="mobile-nav-history"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[56px] px-2 py-1 rounded-xl transition relative active:scale-95 ${
            mobileSidebarOpen
              ? 'text-amber-400 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 font-medium'
          }`}
        >
          <History className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">History</span>
          {userRides.length > 0 && (
            <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-neutral-950 text-[9px] font-extrabold flex items-center justify-center">
              {userRides.length > 9 ? '9+' : userRides.length}
            </span>
          )}
        </button>

        {/* Center Prominent New Ride Action */}
        <button
          id="mobile-nav-new-ride"
          onClick={() => {
            handleNewRide();
            setCurrentView('private');
            setMobileSidebarOpen(false);
          }}
          className="flex flex-col items-center justify-center -mt-5 bg-gradient-to-tr from-amber-500 to-amber-300 text-neutral-950 font-bold w-12 h-12 rounded-full shadow-lg shadow-amber-500/25 border-2 border-neutral-950 active:scale-90 transition"
          title="Log New Ride"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        <button
          id="mobile-nav-community"
          onClick={() => {
            setCurrentView('community');
            setMobileSidebarOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[56px] px-2 py-1 rounded-xl transition active:scale-95 ${
            currentView === 'community' && !mobileSidebarOpen
              ? 'text-amber-400 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 font-medium'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Community</span>
        </button>

        {isAdmin && (
          <button
            id="mobile-nav-admin"
            onClick={() => {
              setCurrentView('admin');
              setMobileSidebarOpen(false);
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] min-w-[56px] px-2 py-1 rounded-xl transition active:scale-95 ${
              currentView === 'admin'
                ? 'text-amber-400 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 font-medium'
            }`}
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Admin</span>
          </button>
        )}
      </nav>
    </div>
  );
};
