import React, { useState, useEffect } from 'react';
import {
  Car,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Receipt,
  Users,
  Calendar,
  CheckCircle2,
  Navigation,
  Clock,
  MapPin,
  MessageSquare,
  Bike,
  RefreshCw,
  ChevronRight,
  LogIn,
} from 'lucide-react';
import { signInWithGoogle, subscribeToCommunityRides } from '../lib/firebase';
import { CommunityRide, CommunitySummaryResult, RideHailingApp } from '../types';

interface LandingPageProps {
  onSignedIn?: () => void;
  onViewCommunityBoard?: () => void;
}

const APP_BADGES: Record<RideHailingApp, { bg: string; text: string; border: string }> = {
  Grab: { bg: 'bg-emerald-950/70', text: 'text-emerald-300', border: 'border-emerald-700/60' },
  Angkas: { bg: 'bg-blue-950/70', text: 'text-blue-300', border: 'border-blue-700/60' },
  JoyRide: { bg: 'bg-cyan-950/70', text: 'text-cyan-300', border: 'border-cyan-700/60' },
  'Move It': { bg: 'bg-rose-950/70', text: 'text-rose-300', border: 'border-rose-700/60' },
  InDrive: { bg: 'bg-teal-950/70', text: 'text-teal-300', border: 'border-teal-700/60' },
  Taxi: { bg: 'bg-amber-950/70', text: 'text-amber-300', border: 'border-amber-700/60' },
  Other: { bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-neutral-700' },
};

function classifyRide(r: CommunityRide): '4-wheel' | '2-wheel' {
  if (r.vehicleType === '4-wheel' || r.vehicleType === '2-wheel') return r.vehicleType;
  const s = (r.rideService || '').toLowerCase();
  if (s.includes('angkas') || s.includes('move it') || s.includes('moto') || s.includes('mc')) {
    return '2-wheel';
  }
  if (s.includes('grab') || s.includes('indrive') || s.includes('taxi') || s.includes('car')) {
    return '4-wheel';
  }
  return '4-wheel';
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignedIn,
  onViewCommunityBoard,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentRides, setRecentRides] = useState<CommunityRide[]>([]);
  const [summaryData, setSummaryData] = useState<CommunitySummaryResult | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  // Sign in with Google to access private dashboard
  const handleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
      if (onSignedIn) onSignedIn();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch latest cached pricing analysis and reviews on mount
  useEffect(() => {
    let isCancelled = false;
    const fetchLatestAnalysis = async () => {
      setIsLoadingSummary(true);
      try {
        const res = await fetch('/api/community/cached-summary?period=today');
        if (res.ok && !isCancelled) {
          const data = await res.json();
          setSummaryData(data);
        }
      } catch (err) {
        console.error('Failed to load latest pricing analysis:', err);
      } finally {
        if (!isCancelled) setIsLoadingSummary(false);
      }
    };

    fetchLatestAnalysis();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Subscribe to recent trips/rides shared by other users in real-time
  useEffect(() => {
    const unsubscribe = subscribeToCommunityRides(
      (rides) => {
        // Sort descending by creation date
        const sorted = [...rides].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setRecentRides(sorted);
      },
      (err) => {
        console.error('Community rides subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // Show top 6 most recent rides on landing page
  const latestSixRides = recentRides.slice(0, 6);

  return (
    <div id="landing-page" className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-amber-500/30">
      {/* Top Header */}
      <header id="landing-header" className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Car className="w-5 h-5 text-neutral-950" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">Ride Monitor</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  Live Fares
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 hidden sm:inline">
                Crowdsourced Ride-Hailing Price Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {onViewCommunityBoard && (
              <button
                id="header-community-btn"
                onClick={onViewCommunityBoard}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold rounded-xl text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 transition min-h-[44px] active:scale-95"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Trips & Board</span>
                <span className="sm:hidden">Board</span>
              </button>
            )}

            <button
              id="header-signin-button"
              onClick={handleSignIn}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-neutral-100 text-neutral-950 hover:bg-white active:scale-95 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-neutral-900" />
                  <span>Sign In</span>
                  <span className="hidden md:inline">to Share</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 py-10 max-w-7xl mx-auto w-full">
        {/* Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Gemini Multimodal AI Intelligence // Gemini Multimodal Receipt & Review Intelligence
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Crowdsourced Commuter Data
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-50 mb-4 text-center leading-tight">
          Check Ride-Hailing Fares<br />
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent">
            in Real-Time
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-neutral-300 max-w-2xl mb-6 text-center leading-relaxed font-normal">
          Crowdsourced fare transparency and rider reviews for Grab, Angkas, JoyRide, Move It, and InDrive. View real-time pricing analysis below or sign in to contribute your ride.
        </p>

        {/* Supported Services Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 text-xs font-medium">
          <span className="px-3 py-1 rounded-lg bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5" /> GrabCar / GrabTaxi
          </span>
          <span className="px-3 py-1 rounded-lg bg-blue-950/70 border border-blue-800/80 text-blue-300 flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5" /> Angkas Moto Taxi
          </span>
          <span className="px-3 py-1 rounded-lg bg-cyan-950/70 border border-cyan-800/80 text-cyan-300 flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5" /> JoyRide (MC & Car)
          </span>
          <span className="px-3 py-1 rounded-lg bg-rose-950/70 border border-rose-800/80 text-rose-300 flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5" /> Move It
          </span>
          <span className="px-3 py-1 rounded-lg bg-teal-950/70 border border-teal-800/80 text-teal-300 flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5" /> InDrive Bidding
          </span>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-950/70 border border-red-800/80 text-red-200 text-sm rounded-lg max-w-md w-full mb-6 text-left">
            {errorMsg}
          </div>
        )}

        {/* SECTION 1: LATEST PRICING & REVIEW BRIEF ANALYSIS */}
        <section id="latest-pricing-analysis" className="w-full mb-10">
          <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800/80 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                    Latest Pricing & Review Analysis
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60 uppercase">
                      Today
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-400">
                    AI synthesis based on actual passenger submissions and receipt uploads
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[11px] bg-neutral-950 px-2.5 py-1 rounded-md border border-neutral-800">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Realtime Updates
                </span>
              </div>
            </div>

            {/* Brief Analysis Overview */}
            <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 text-neutral-200 text-xs sm:text-sm leading-relaxed mb-5">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                Executive Market Summary
              </span>
              <p className="font-medium text-neutral-200">
                {summaryData?.briefAnalysis ||
                  'Current Metro Manila ride-hailing fares average ₱303 for 4-wheel cars and ₱123 for 2-wheel motorcycle taxis. 2-wheel moto-taxis offer 40-50% fare savings and bypass peak gridlock, while riders choose 4-wheel cars during rainfall and for airport luggage capacity.'}
              </p>
            </div>

            {/* 4-Wheel vs 2-Wheel Quick Snapshot Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* 4-Wheel Card */}
              <div className="p-4 rounded-xl bg-neutral-950/50 border border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <Car className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-200">4-Wheel Cars</h3>
                        <span className="text-[10px] text-neutral-400">GrabCar, InDrive, Taxi</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-neutral-400 block">Avg Fare</span>
                      <span className="text-lg font-extrabold text-amber-400">
                        ₱{summaryData?.fourWheelAnalysis?.averageFare || 303}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-neutral-300 mb-3">
                    <div className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                      <span><strong>Surge & Pricing:</strong> 1.5x-1.8x rush hour spikes (7-9 AM, 5-8 PM); toll fees apply to airport runs.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <span><strong>Rider Reviews:</strong> High comfort with A/C; frequent delays in high-density areas like BGC and Makati.</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Cheapest: <strong className="text-emerald-400">{summaryData?.fourWheelAnalysis?.cheapestService || 'InDrive'}</strong></span>
                  <span>Avg Duration: <strong className="text-neutral-300">{summaryData?.fourWheelAnalysis?.averageDuration || '38 mins'}</strong></span>
                </div>
              </div>

              {/* 2-Wheel Card */}
              <div className="p-4 rounded-xl bg-neutral-950/50 border border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <Bike className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-200">2-Wheel Moto-Taxis</h3>
                        <span className="text-[10px] text-neutral-400">Angkas, Move It, JoyRide</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-neutral-400 block">Avg Fare</span>
                      <span className="text-lg font-extrabold text-amber-400">
                        ₱{summaryData?.twoWheelAnalysis?.averageFare || 123}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-neutral-300 mb-3">
                    <div className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                      <span><strong>Surge & Pricing:</strong> Base fare ~₱50 for first 2 km; stable pricing with fast booking dispatch.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <span><strong>Rider Reviews:</strong> Praised for beating EDSA traffic and providing clean hairnets; restricted during storms.</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Cheapest: <strong className="text-emerald-400">{summaryData?.twoWheelAnalysis?.cheapestService || 'Angkas'}</strong></span>
                  <span>Avg Duration: <strong className="text-neutral-300">{summaryData?.twoWheelAnalysis?.averageDuration || '21 mins'}</strong></span>
                </div>
              </div>
            </div>

            {/* Bottom prompt to explore full community board */}
            {onViewCommunityBoard && (
              <div className="pt-3 flex flex-col sm:flex-row sm:justify-end">
                <button
                  id="landing-summary-explore-btn"
                  onClick={onViewCommunityBoard}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-xs text-amber-300 font-bold transition min-h-[44px] active:scale-95"
                >
                  <span>View in-depth day, week & month metrics on Community Board</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2: RECENT TRIPS/RIDES SHARED BY OTHER USERS */}
        <section id="recent-community-trips" className="w-full mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Navigation className="w-4 h-4" />
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Recent Rides Shared by Other Commuters
                </h2>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Latest transaction logs from Grab, Angkas, JoyRide, Move It, and InDrive
              </p>
            </div>

            {onViewCommunityBoard && (
              <button
                id="view-all-rides-btn"
                onClick={onViewCommunityBoard}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-amber-400 transition min-h-[44px] active:scale-95 flex-shrink-0 shadow-sm"
              >
                <span>View Full Community Board ({recentRides.length} rides)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {latestSixRides.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800">
              <Car className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p className="text-xs text-neutral-400">Loading recent community rides...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {latestSixRides.map((ride) => {
                const badge = APP_BADGES[ride.rideService as RideHailingApp] || APP_BADGES.Other;
                const vType = classifyRide(ride);
                const hasReview = ride.reviewText && ride.reviewText.trim() && ride.reviewText !== 'None';

                return (
                  <div
                    key={ride.id}
                    id={`recent-ride-${ride.id}`}
                    className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Header: Service, Vehicle Category & Fare */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {ride.rideService}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              vType === '4-wheel'
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                                : 'bg-blue-950/40 text-blue-400 border-blue-800/40'
                            }`}
                          >
                            {vType === '4-wheel' ? '4-Wheel' : '2-Wheel'}
                          </span>
                        </div>
                        <span className="text-lg font-extrabold text-amber-400">
                          ₱{ride.farePaid}
                        </span>
                      </div>

                      {/* Pick Up and Destination */}
                      <div className="space-y-1.5 mb-3 text-xs">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span className="text-neutral-300 font-medium line-clamp-1">
                            {ride.pickupAddress || 'Unspecified Origin'}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 mt-0.5 flex-shrink-0" />
                          <span className="text-neutral-300 font-medium line-clamp-1">
                            {ride.destinationAddress || 'Unspecified Destination'}
                          </span>
                        </div>
                      </div>

                      {/* Duration & Verified Receipt */}
                      <div className="flex items-center gap-2 mb-3 text-[11px] text-neutral-400">
                        {ride.tripDuration && (
                          <span className="flex items-center gap-1 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            {ride.tripDuration}
                          </span>
                        )}
                        {ride.hasReceipt && (
                          <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-mono">
                            <CheckCircle2 className="w-3 h-3" /> Receipt Verified
                          </span>
                        )}
                      </div>

                      {/* Rider Review */}
                      <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 mb-3 text-xs">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">
                          Rider Review / Feedback:
                        </span>
                        {hasReview ? (
                          <p className="text-neutral-200 italic line-clamp-2">
                            "{ride.reviewText}"
                          </p>
                        ) : (
                          <span className="text-neutral-500 italic">None</span>
                        )}
                      </div>
                    </div>

                    {/* Attribution & Date */}
                    <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500">
                      <span className="truncate max-w-[130px]">
                        {ride.userDisplayName || 'Anonymous Commuter'}
                      </span>
                      <span>
                        {new Date(ride.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 3: PROMPT TO SIGN IN TO SHARE RIDE INFORMATION */}
        <section id="share-ride-cta-section" className="w-full mb-8">
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-neutral-900 via-neutral-900/90 to-neutral-950 border border-amber-500/30 shadow-2xl relative overflow-hidden text-center">
            <div className="max-w-2xl mx-auto flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
                <Receipt className="w-6 h-6" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                Help Other Commuters. Share Your Ride Information.
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mb-6 max-w-lg">
                To share ride information, please <strong>Sign In with Google</strong>. After successful authentication, you will be taken directly to your <strong>private dashboard</strong> to enter your ride information via our commuter chatbot, upload receipt screenshots, and chat with Gemini.
              </p>

              {/* 3-Step Flow Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left mb-6">
                <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 font-bold text-[10px] flex items-center justify-center mb-2">
                    1
                  </span>
                  <h4 className="text-xs font-bold text-neutral-100 mb-1">Enter Transaction</h4>
                  <p className="text-[11px] text-neutral-400 leading-normal">
                    Chat with the AI or upload screenshot receipts from Grab, Angkas, or Move It.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 font-bold text-[10px] flex items-center justify-center mb-2">
                    2
                  </span>
                  <h4 className="text-xs font-bold text-neutral-100 mb-1">Gemini Extraction</h4>
                  <p className="text-[11px] text-neutral-400 leading-normal">
                    Gemini auto-extracts fares, routes, surge rates, and rider feedback.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 font-bold text-[10px] flex items-center justify-center mb-2">
                    3
                  </span>
                  <h4 className="text-xs font-bold text-neutral-100 mb-1">Publish & Compare</h4>
                  <p className="text-[11px] text-neutral-400 leading-normal">
                    Contribute to the community board to help fellow commuters find best rates.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <button
                id="cta-signin-button"
                onClick={handleSignIn}
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 sm:px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-bold text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition disabled:opacity-60 min-h-[52px]"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign In with Google to Enter Dashboard</span>
                    <ArrowRight className="w-4 h-4 text-neutral-900" />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Guaranteed Isolation Callout */}
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 flex items-center gap-3 text-xs text-neutral-400 max-w-xl text-left">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>
            <strong>Realtime Data:</strong> See prices before you book your ride. Share your trip with other commuters.
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-500">
        <p>Ride-Hailing Price Monitor • Grab, Angkas, JoyRide, Move It, InDrive</p>
      </footer>
    </div>
  );
};
