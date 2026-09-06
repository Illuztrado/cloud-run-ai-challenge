/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, syncUserProfile, subscribeToCommunityRides } from './lib/firebase';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { CommunityBoard } from './components/CommunityBoard';
import { CommunityRide } from './types';
import { Sparkles } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthView, setUnauthView] = useState<'landing' | 'community'>('landing');
  const [communityRides, setCommunityRides] = useState<CommunityRide[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await syncUserProfile(currentUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Realtime subscription for unauthenticated community view
  useEffect(() => {
    const unsubscribe = subscribeToCommunityRides(
      (rides) => {
        setCommunityRides(rides);
      },
      (err) => {
        console.error('Community rides subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-neutral-100">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 animate-bounce">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="text-sm font-medium text-neutral-300">Loading ride-hailing price monitor...</div>
      </div>
    );
  }

  // Once authenticated, always take user directly to their private dashboard
  if (user) {
    return (
      <div className="w-full h-full min-h-screen bg-neutral-950 text-neutral-100 selection:bg-amber-500/30">
        <Dashboard user={user} />
      </div>
    );
  }

  // If unauthenticated, allow seamless toggle between Landing Page and Community Board
  return (
    <div className="w-full h-full min-h-screen bg-neutral-950 text-neutral-100 selection:bg-amber-500/30 flex flex-col">
      {unauthView === 'landing' ? (
        <LandingPage
          onViewCommunityBoard={() => setUnauthView('community')}
        />
      ) : (
        <CommunityBoard
          rides={communityRides}
          user={null}
          onBackToLanding={() => setUnauthView('landing')}
        />
      )}
    </div>
  );
}
