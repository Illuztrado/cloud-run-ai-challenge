import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Calendar,
  Sparkles,
  TrendingUp,
  MapPin,
  Clock,
  Car,
  Filter,
  Search,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Award,
  ChevronDown,
  ArrowLeft,
  LogIn,
  Layers,
  Bike,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  CommunityRide,
  CommunityTimeFilter,
  RideHailingApp,
  CommunitySummaryResult,
  VehicleCategory,
  CategoryAnalysis,
} from '../types';
import { signInWithGoogle } from '../lib/firebase';

interface CommunityBoardProps {
  rides: CommunityRide[];
  user?: User | null;
  onRefresh?: () => void;
  onBackToLanding?: () => void;
  onSignedIn?: () => void;
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
  if (s.includes('joyride')) {
    return '2-wheel';
  }
  return '4-wheel';
}

export const CommunityBoard: React.FC<CommunityBoardProps> = ({
  rides,
  user,
  onRefresh,
  onBackToLanding,
  onSignedIn,
}) => {
  const [timeFilter, setTimeFilter] = useState<CommunityTimeFilter>('today');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | '4-wheel' | '2-wheel'>('all');
  const [appFilter, setAppFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [summaryData, setSummaryData] = useState<CommunitySummaryResult | null>(null);
  const [isFetchingCache, setIsFetchingCache] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'both' | '4-wheel' | '2-wheel'>('both');

  // Filter rides according to current Day, Week, or Month
  const filteredRidesByTime = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;

    return rides.filter((ride) => {
      const rideTime = new Date(ride.createdAt).getTime();
      if (timeFilter === 'today') return rideTime >= todayStart;
      if (timeFilter === 'week') return rideTime >= weekStart;
      if (timeFilter === 'month') return rideTime >= monthStart;
      return true;
    });
  }, [rides, timeFilter]);

  // Secondary filters (Vehicle Category, App & Search query)
  const displayedRides = useMemo(() => {
    return filteredRidesByTime.filter((ride) => {
      const vCat = classifyRide(ride);
      const matchVehicle = vehicleFilter === 'all' || vCat === vehicleFilter;
      const matchApp = appFilter === 'all' || ride.rideService === appFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (ride.pickupAddress && ride.pickupAddress.toLowerCase().includes(q)) ||
        (ride.destinationAddress && ride.destinationAddress.toLowerCase().includes(q)) ||
        (ride.rideService && ride.rideService.toLowerCase().includes(q)) ||
        (ride.reviewText && ride.reviewText.toLowerCase().includes(q));

      return matchVehicle && matchApp && matchSearch;
    });
  }, [filteredRidesByTime, vehicleFilter, appFilter, searchQuery]);

  /**
   * Fetches the current cached ride analysis for the selected timeframe.
   * Strictly adheres to:
   * "Analysis should be cached at reasonable intervals. No AI analysis/summary
   * fetching can be triggered by users. The 'Refresh AI Summary' should only
   * fetch the current cached ride analysis."
   */
  const fetchCachedSummary = async (period: CommunityTimeFilter) => {
    setIsFetchingCache(true);
    try {
      // First try fetching the current 15-minute cached analysis
      const res = await fetch(`/api/community/cached-summary?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      } else {
        // Fallback to summarize endpoint (which also enforces cache on server)
        const postRes = await fetch('/api/community/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            period,
            rides: filteredRidesByTime,
          }),
        });
        if (postRes.ok) {
          const data = await postRes.json();
          setSummaryData(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch cached ride analysis:', err);
    } finally {
      setIsFetchingCache(false);
    }
  };

  useEffect(() => {
    fetchCachedSummary(timeFilter);
  }, [timeFilter]);

  const handleManualSignIn = async () => {
    setSignInLoading(true);
    try {
      await signInWithGoogle();
      if (onSignedIn) onSignedIn();
    } catch (err: any) {
      console.error('Sign in error:', err);
    } finally {
      setSignInLoading(false);
    }
  };

  return (
    <div id="community-board-page" className="flex-1 flex flex-col min-h-0 bg-neutral-950 text-neutral-100 overflow-y-auto selection:bg-amber-500/30">
      {/* Top Banner & Header */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-neutral-800/80 bg-neutral-900/40 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            {onBackToLanding && (
              <button
                id="back-to-landing-btn"
                onClick={onBackToLanding}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 border border-neutral-700/80 transition min-h-[44px] active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Landing</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Users className="w-4 h-4" />
                </span>
                <h2 className="text-base sm:text-xl font-bold tracking-tight text-white">
                  Community Board
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 hidden sm:inline">
                  4-Wheels & MotoTaxis
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
                Crowdsourced fare benchmarks across Grab, Angkas, JoyRide, Move It, and InDrive
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Timeframe Filter Tabs: Current Day, Week, Month, All */}
            <div className="flex items-center p-1 bg-neutral-900 border border-neutral-800 rounded-xl text-xs overflow-x-auto max-w-full">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'week', label: 'This Week' },
                  { id: 'month', label: 'This Month' },
                  { id: 'all', label: 'All Records' },
                ] as { id: CommunityTimeFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  id={`time-tab-${tab.id}`}
                  onClick={() => setTimeFilter(tab.id)}
                  className={`px-3 py-2 rounded-lg font-semibold transition whitespace-nowrap min-h-[40px] active:scale-95 ${
                    timeFilter === tab.id
                      ? 'bg-amber-400 text-neutral-950 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Prompt unauthenticated visitor to sign in to share ride information */}
            {!user && (
              <button
                id="community-header-signin-btn"
                onClick={handleManualSignIn}
                disabled={signInLoading}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold transition shadow-sm min-h-[44px] active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{signInLoading ? 'Signing In...' : 'Sign In to Share Ride'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 w-full space-y-6">
        {/* Unauthenticated Visitor Sign-In Callout */}
        {!user && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-600/5 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-200">
                  Want to contribute your fare and chat with Gemini?
                </h4>
                <p className="text-xs text-neutral-300 mt-0.5">
                  Sign in with Google to access your private dashboard, scan ride receipts, converse with the AI commuter advisor, and share fare transparency.
                </p>
              </div>
            </div>
            <button
              id="visitor-callout-signin-btn"
              onClick={handleManualSignIn}
              disabled={signInLoading}
              className="w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold shadow-md active:scale-95 transition min-h-[44px]"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In with Google</span>
            </button>
          </div>
        )}

        {/* Separated 4-Wheel & 2-Wheel Gemini Pricing & Review Intelligence Card */}
        <div className="p-4 sm:p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Card Header & Cached Refresh Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-neutral-100">
                    Pricing & Review Intelligence Summary
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-400 border border-amber-800/60 uppercase">
                    {timeFilter === 'today' ? 'Current Day' : timeFilter === 'week' ? 'Current Week' : timeFilter === 'month' ? 'Current Month' : 'All Time'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mt-0.5">
                  <span>Separate 4-Wheel vs 2-Wheel Comparison</span>
                  <span>.</span>
                  <span className="text-emerald-400 font-mono text-[11px]">
                    Realtime Feed Updates
                  </span>
                </div>
              </div>
            </div>

            {/* Refresh AI Summary Button: strictly fetches the cached analysis */}
            <button
              id="refresh-cached-summary-btn"
              onClick={() => fetchCachedSummary(timeFilter)}
              disabled={isFetchingCache}
              title="Fetches the current 15-minute cached ride analysis"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 border border-neutral-700 transition active:scale-95 disabled:opacity-60 min-h-[44px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingCache ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isFetchingCache ? 'Fetching Cached...' : 'Refresh AI Summary'}</span>
            </button>
          </div>

          {/* Executive Briefing Banner */}
          {summaryData?.briefAnalysis && (
            <div className="my-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs sm:text-sm text-neutral-200 leading-relaxed">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                Executive Commuter Briefing
              </span>
              <p className="text-neutral-200 font-medium">
                {summaryData.briefAnalysis}
              </p>
            </div>
          )}

          {/* Category Toggle Tabs for In-Depth Analytics */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4 pt-1">
            <span className="text-xs text-neutral-400 font-medium">View Analysis:</span>
            <div className="flex items-center p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveAnalysisTab('both')}
                className={`px-3 py-2 rounded-lg font-semibold transition whitespace-nowrap min-h-[38px] active:scale-95 ${
                  activeAnalysisTab === 'both'
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Side-by-Side (4W & 2W)
              </button>
              <button
                onClick={() => setActiveAnalysisTab('4-wheel')}
                className={`px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 whitespace-nowrap min-h-[38px] active:scale-95 ${
                  activeAnalysisTab === '4-wheel'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                4-Wheels
              </button>
              <button
                onClick={() => setActiveAnalysisTab('2-wheel')}
                className={`px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 whitespace-nowrap min-h-[38px] active:scale-95 ${
                  activeAnalysisTab === '2-wheel'
                    ? 'bg-blue-950 text-blue-300 border border-blue-800'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                2-Wheel Moto Taxis
              </button>
            </div>
          </div>

          {/* Separated 4-Wheel and 2-Wheel Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {/* 4-WHEEL ANALYSIS CARD */}
            {(activeAnalysisTab === 'both' || activeAnalysisTab === '4-wheel') && (
              <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <Car className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-neutral-100">
                          4-Wheel Bookings
                        </h4>
                        <span className="text-[10px] text-neutral-400">
                          GrabCar, InDrive, JoyRide Car, Metered Taxi
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                      {summaryData?.fourWheelAnalysis?.totalTrips || 0} trips
                    </span>
                  </div>

                  {/* 4-Wheel Metrics */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80">
                      <span className="text-[10px] text-neutral-400 block">Avg Fare</span>
                      <span className="text-base font-extrabold text-amber-400">
                        {summaryData?.fourWheelAnalysis?.averageFare ? `₱${summaryData.fourWheelAnalysis.averageFare}` : '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80">
                      <span className="text-[10px] text-neutral-400 block">Cheapest</span>
                      <span className="text-sm font-bold text-emerald-400 truncate block">
                        {summaryData?.fourWheelAnalysis?.cheapestService || '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80">
                      <span className="text-[10px] text-neutral-400 block">Avg Duration</span>
                      <span className="text-xs font-semibold text-neutral-300">
                        {summaryData?.fourWheelAnalysis?.averageDuration || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* 4-Wheel Platform Averages */}
                  {summaryData?.fourWheelAnalysis?.fareSummaryByApp && summaryData.fourWheelAnalysis.fareSummaryByApp.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {summaryData.fourWheelAnalysis.fareSummaryByApp.map((app) => (
                        <div key={app.service} className="px-2 py-1 bg-neutral-900 rounded border border-neutral-800 text-[11px] flex items-center gap-1.5">
                          <span className="text-neutral-400">{app.service}:</span>
                          <span className="font-bold text-amber-300">₱{app.avgFare}</span>
                          {app.avgDuration && (
                            <span className="text-[10px] text-neutral-500 font-mono">({app.avgDuration})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 4-Wheel Pricing & Surge Trends */}
                  <div className="mb-3">
                    <h5 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      4-Wheel Pricing & Surge Trends
                    </h5>
                    <ul className="space-y-1 text-xs text-neutral-300">
                      {(summaryData?.fourWheelAnalysis?.pricingAndSurgeTrends || [
                        'GrabCar experiences 1.5x-1.8x surges during rush hours and rainy conditions.',
                        'InDrive allows passenger bidding to negotiate lower fares off-peak.',
                        'Toll charges (Skyway / NAIAX) are added on top of base fares for airport routes.',
                      ]).map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 4-Wheel Review Insights */}
                  <div className="mb-3">
                    <h5 className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-blue-400" />
                      4-Wheel Rider Reviews & Feedback
                    </h5>
                    <ul className="space-y-1 text-xs text-neutral-300">
                      {(summaryData?.fourWheelAnalysis?.reviewInsights || [
                        'Riders value cool air-conditioning and spacious trunk space for luggage.',
                        'Cancellations and longer pickup waiting times reported in BGC and Ortigas.',
                      ]).map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 4-Wheel Comparison Narrative */}
                  {summaryData?.fourWheelAnalysis?.comparisonNarrative && (
                    <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs text-neutral-300">
                      <strong className="text-emerald-400 font-semibold block mb-0.5">4-Wheel Comparison:</strong>
                      {summaryData.fourWheelAnalysis.comparisonNarrative}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2-WHEEL ANALYSIS CARD */}
            {(activeAnalysisTab === 'both' || activeAnalysisTab === '2-wheel') && (
              <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <Bike className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-neutral-100">
                          Moto Taxi Bookings
                        </h4>
                        <span className="text-[10px] text-neutral-400">
                          Angkas, Move It, JoyRide MC
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-blue-400 bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 rounded-full">
                      {summaryData?.twoWheelAnalysis?.totalTrips || 0} trips
                    </span>
                  </div>

                  {/* 2-Wheel Metrics */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80">
                      <span className="text-[10px] text-neutral-400 block">Avg Fare</span>
                      <span className="text-base font-extrabold text-amber-400">
                        {summaryData?.twoWheelAnalysis?.averageFare ? `₱${summaryData.twoWheelAnalysis.averageFare}` : '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80">
                      <span className="text-[10px] text-neutral-400 block">Cheapest</span>
                      <span className="text-sm font-bold text-emerald-400 truncate block">
                        {summaryData?.twoWheelAnalysis?.cheapestService || '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80">
                      <span className="text-[10px] text-neutral-400 block">Avg Duration</span>
                      <span className="text-xs font-semibold text-neutral-300">
                        {summaryData?.twoWheelAnalysis?.averageDuration || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* 2-Wheel Platform Averages */}
                  {summaryData?.twoWheelAnalysis?.fareSummaryByApp && summaryData.twoWheelAnalysis.fareSummaryByApp.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {summaryData.twoWheelAnalysis.fareSummaryByApp.map((app) => (
                        <div key={app.service} className="px-2 py-1 bg-neutral-900 rounded border border-neutral-800 text-[11px] flex items-center gap-1.5">
                          <span className="text-neutral-400">{app.service}:</span>
                          <span className="font-bold text-amber-300">₱{app.avgFare}</span>
                          {app.avgDuration && (
                            <span className="text-[10px] text-neutral-500 font-mono">({app.avgDuration})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 2-Wheel Pricing & Surge Trends */}
                  <div className="mb-3">
                    <h5 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      2-Wheel Pricing & Surge Trends
                    </h5>
                    <ul className="space-y-1 text-xs text-neutral-300">
                      {(summaryData?.twoWheelAnalysis?.pricingAndSurgeTrends || [
                        'Base fares stay close to ~₱50 for first 2 km under LTFRB pilot guidelines.',
                        'Motorcycle taxis bypass gridlock, reducing travel duration by up to 40-50%.',
                        'Heavy rainfall halts availability due to safety requirements.',
                      ]).map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 2-Wheel Review Insights */}
                  <div className="mb-3">
                    <h5 className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-blue-400" />
                      2-Wheel Rider Reviews & Feedback
                    </h5>
                    <ul className="space-y-1 text-xs text-neutral-300">
                      {(summaryData?.twoWheelAnalysis?.reviewInsights || [
                        'Clean hairnets and well-fitting helmets are consistently praised by riders.',
                        'Fast dispatch acceptance reported for Move It and JoyRide during peak hours.',
                      ]).map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 2-Wheel Comparison Narrative */}
                  {summaryData?.twoWheelAnalysis?.comparisonNarrative && (
                    <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs text-neutral-300">
                      <strong className="text-blue-400 font-semibold block mb-0.5">2-Wheel Comparison:</strong>
                      {summaryData.twoWheelAnalysis.comparisonNarrative}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cross-Category Comparison Footer */}
          {summaryData?.crossCategoryComparison && (
            <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-300">
              <strong className="text-amber-400 font-semibold uppercase tracking-wider block mb-1">
                4-Wheel vs. 2-Wheel Market Comparison:
              </strong>
              <p>{summaryData.crossCategoryComparison}</p>
            </div>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          {/* Vehicle Category Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0">
            <div className="flex items-center p-1 bg-neutral-900 border border-neutral-800 rounded-xl text-xs overflow-x-auto">
              <button
                onClick={() => setVehicleFilter('all')}
                className={`px-3 py-2 rounded-lg font-semibold transition whitespace-nowrap min-h-[40px] active:scale-95 ${
                  vehicleFilter === 'all'
                    ? 'bg-neutral-100 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                All Vehicles
              </button>
              <button
                onClick={() => setVehicleFilter('4-wheel')}
                className={`px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 whitespace-nowrap min-h-[40px] active:scale-95 ${
                  vehicleFilter === '4-wheel'
                    ? 'bg-emerald-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                4-Wheel Cars
              </button>
              <button
                onClick={() => setVehicleFilter('2-wheel')}
                className={`px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 whitespace-nowrap min-h-[40px] active:scale-95 ${
                  vehicleFilter === '2-wheel'
                    ? 'bg-blue-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                2-Wheel Moto-Taxis
              </button>
            </div>
          </div>

          {/* App Filter Chips & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
              {['all', 'Grab', 'Angkas', 'JoyRide', 'Move It', 'InDrive', 'Taxi'].map((app) => (
                <button
                  key={app}
                  onClick={() => setAppFilter(app)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition min-h-[40px] active:scale-95 ${
                    appFilter === app
                      ? 'bg-neutral-200 text-neutral-950 border-neutral-200 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {app === 'all' ? 'All Apps' : app}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search route, fare, review..."
                className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 min-h-[44px]"
              />
            </div>
          </div>
        </div>

        {/* Crowdsourced Transactions List */}
        <div>
          <div className="flex items-center justify-between mb-3 text-xs text-neutral-400">
            <span>
              Showing <strong>{displayedRides.length}</strong> logged {displayedRides.length === 1 ? 'ride' : 'rides'} for {timeFilter === 'today' ? 'Current Day' : timeFilter === 'week' ? 'Current Week' : timeFilter === 'month' ? 'Current Month' : 'All Time'}
            </span>
            <span className="font-mono text-[11px] text-emerald-400">
              Crowdsourced Fares • Live
            </span>
          </div>

          {displayedRides.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-neutral-900/30 border border-neutral-800">
              <Car className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-neutral-300 mb-1">
                No Rides Found
              </h4>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4">
                No rides have been shared matching this filter. Log your transaction to contribute fare transparency!
              </p>
              {!user && (
                <button
                  onClick={handleManualSignIn}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-neutral-950 text-xs font-bold shadow transition"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Log Your Trip</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedRides.map((r) => {
                const badge = APP_BADGES[r.rideService as RideHailingApp] || APP_BADGES.Other;
                const vType = classifyRide(r);
                const hasReview = r.reviewText && r.reviewText.trim() && r.reviewText !== 'None';

                return (
                  <div
                    key={r.id}
                    id={`community-ride-${r.id}`}
                    className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header: Service Badge, Vehicle Type & Fare */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {r.rideService}
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
                          ₱{r.farePaid}
                        </span>
                      </div>

                      {/* Route Pick Up & Drop Off */}
                      <div className="space-y-1.5 mb-3 text-xs">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span className="text-neutral-300 font-medium line-clamp-1">
                            {r.pickupAddress || 'Unspecified Origin'}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 mt-0.5 flex-shrink-0" />
                          <span className="text-neutral-300 font-medium line-clamp-1">
                            {r.destinationAddress || 'Unspecified Destination'}
                          </span>
                        </div>
                      </div>

                      {/* Metrics: Duration & Distance */}
                      <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] text-neutral-400">
                        {r.tripDuration && (
                          <span className="flex items-center gap-1 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            {r.tripDuration}
                          </span>
                        )}
                        {r.tripDistance && (
                          <span className="bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                            {r.tripDistance}
                          </span>
                        )}
                        {r.hasReceipt && (
                          <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-mono">
                            <CheckCircle2 className="w-3 h-3" /> Receipt Verified
                          </span>
                        )}
                      </div>

                      {/* Review / Feedback block */}
                      <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 mb-3 text-xs">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">
                          Rider Review / Feedback:
                        </span>
                        {hasReview ? (
                          <p className="text-neutral-200 italic line-clamp-2">
                            "{r.reviewText}"
                          </p>
                        ) : (
                          <span className="text-neutral-500 italic">None</span>
                        )}
                      </div>
                    </div>

                    {/* Footer: User Attribution & Timestamp */}
                    <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500">
                      <span className="truncate max-w-[130px]">
                        {r.userDisplayName || 'Anonymous Rider'}
                      </span>
                      <span>
                        {new Date(r.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
