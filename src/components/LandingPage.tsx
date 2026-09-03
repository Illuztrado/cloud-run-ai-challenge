import React, { useState } from 'react';
import { Sparkles, ShieldCheck, Lock, BookOpen, Compass, Lightbulb, ArrowRight, MessageSquare, Flame } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

interface LandingPageProps {
  onSignedIn?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignedIn }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return (
    <div id="landing-page" className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-amber-500/30">
      {/* Top Navigation */}
      <header id="landing-header" className="border-b border-neutral-800/80 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-neutral-950" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-white">Gemini Reflection</span>
              <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-amber-400 border border-neutral-700">Firestore Secure</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              id="header-signin-button"
              onClick={handleSignIn}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-neutral-100 text-neutral-950 hover:bg-white active:scale-98 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
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
                  <span>Sign In</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 mb-8 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Private, Encrypted & User-Isolated Cloud Firestore</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-tight text-neutral-50 mb-6 leading-tight">
          A thoughtful space for <br />
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent italic">
            deep personal reflections
          </span>
        </h1>

        {/* Description */}
        <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mb-10 leading-relaxed font-light">
          Converse with Gemini to unpack your thoughts, uncover recurring themes, brainstorm solutions, and maintain a secure archive of your journey.
        </p>

        {/* Call To Action */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mb-6">
          <button
            id="hero-signin-button"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-semibold text-base shadow-xl shadow-amber-500/20 active:scale-98 transition disabled:opacity-60"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4 text-neutral-900" />
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/70 border border-red-800/80 text-red-200 text-sm rounded-lg max-w-md w-full mb-6 text-left">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center gap-6 text-xs text-neutral-500 mt-2">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" /> End-to-end user isolation
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Gemini 2.5 Flash
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-neutral-400" /> Multi-turn journals
          </span>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-20 w-full text-left">
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-neutral-100 mb-2">Multi-Turn Dialogue</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Have nuanced back-and-forth conversations to articulate emotions, untangle challenges, and discover clarity.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-4">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-neutral-100 mb-2">AI Summaries & Ideation</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Auto-generate structured summaries, emotional mood tags, action items, and fresh angles on your reflections.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-neutral-100 mb-2">Strict Data Isolation</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Your entries are securely mapped to your user ID with Cloud Firestore security rules. No one else can read your entries.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-500">
        <p>Powered by Google AI Studio Gemini API & Firebase Firestore.</p>
      </footer>
    </div>
  );
};
