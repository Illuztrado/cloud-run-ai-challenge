import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  saveJournalEntry,
  deleteJournalEntry,
  subscribeToUserEntries,
  logOut,
} from '../lib/firebase';
import { JournalEntry, AISummaryResult } from '../types';
import { Navbar } from './Navbar';
import { HistorySidebar } from './HistorySidebar';
import { ReflectionWorkspace } from './ReflectionWorkspace';
import { Menu, Sparkles, BookOpen, AlertCircle } from 'lucide-react';

interface DashboardProps {
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [failedEntryToRetry, setFailedEntryToRetry] = useState<JournalEntry | null>(null);
  const [isRetryingSave, setIsRetryingSave] = useState(false);

  // Auto-save debounce timer
  const saveTimeoutRef = useRef<any>(null);

  // Create a brand new blank entry
  const createNewEntry = useCallback((): JournalEntry => {
    const newId = 'entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    return {
      id: newId,
      userId: user.uid,
      title: 'Untitled Reflection',
      summary: '',
      tags: [],
      mood: 'Reflective',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }, [user.uid]);

  // Subscribe to realtime updates for this user's isolated Firestore entries
  useEffect(() => {
    if (!user || !user.uid) return;

    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
        setFirestoreError(null);

        // If no entry is currently selected or current selection was deleted
        setSelectedEntryId((prevId) => {
          if (prevId && fetchedEntries.some((e) => e.id === prevId)) {
            return prevId;
          }
          if (fetchedEntries.length > 0) {
            return fetchedEntries[0].id;
          }
          return null;
        });
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setFirestoreError('Failed to sync entries with Firestore. Please ensure your session is valid.');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Derive active selected entry
  const activeEntry: JournalEntry = React.useMemo(() => {
    const found = entries.find((e) => e.id === selectedEntryId);
    if (found) return found;

    // If no existing entries in Firestore, initialize a transient new entry
    return createNewEntry();
  }, [entries, selectedEntryId, createNewEntry]);

  // Update entry handler with auto-save to Firestore
  const handleUpdateEntry = (updates: Partial<JournalEntry>) => {
    const updatedEntry: JournalEntry = {
      ...activeEntry,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Optimistically update local entries state
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === updatedEntry.id);
      if (exists) {
        return prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e));
      } else {
        return [updatedEntry, ...prev];
      }
    });

    if (selectedEntryId !== updatedEntry.id) {
      setSelectedEntryId(updatedEntry.id);
    }

    // Debounce save to Firestore
    setIsSaving(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveJournalEntry(user.uid, updatedEntry);
        setFirestoreError(null);
        setFailedEntryToRetry(null);
      } catch (err: any) {
        console.error('Error saving to Firestore:', err);
        setFailedEntryToRetry(updatedEntry);
        setFirestoreError(`Database save error: ${err.message || 'Could not persist entry to Firestore.'}`);
      } finally {
        setIsSaving(false);
      }
    }, 600);
  };

  // Retry Save action
  const handleRetrySave = async () => {
    if (!failedEntryToRetry) return;
    setIsRetryingSave(true);
    try {
      await saveJournalEntry(user.uid, failedEntryToRetry);
      setFirestoreError(null);
      setFailedEntryToRetry(null);
    } catch (err: any) {
      console.error('Retry save failed:', err);
      setFirestoreError(`Retry failed: ${err.message || 'Database error occurred.'}`);
    } finally {
      setIsRetryingSave(false);
    }
  };

  // Handle New Entry creation
  const handleNewEntry = () => {
    const freshEntry = createNewEntry();
    setEntries((prev) => [freshEntry, ...prev]);
    setSelectedEntryId(freshEntry.id);
    setMobileSidebarOpen(false);
  };

  // Handle Delete Entry
  const handleDeleteEntry = async (entryId: string) => {
    try {
      await deleteJournalEntry(user.uid, entryId);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      if (selectedEntryId === entryId) {
        const remaining = entries.filter((e) => e.id !== entryId);
        setSelectedEntryId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  // AI Auto-Summarize & Metadata generator
  const handleAutoSummarize = async () => {
    if (!activeEntry.messages || activeEntry.messages.length === 0) return;

    setIsSummarizing(true);
    try {
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: activeEntry.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const result: AISummaryResult = await response.json();

      handleUpdateEntry({
        title: result.title || activeEntry.title,
        summary: result.summary || activeEntry.summary,
        tags: Array.from(new Set([...(activeEntry.tags || []), ...(result.tags || [])])),
        mood: result.mood || activeEntry.mood || 'Reflective',
      });
    } catch (err) {
      console.error('Error during auto-summarize:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div id="dashboard-container" className="flex flex-col h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Top Navbar */}
      <Navbar
        user={user}
        onNewEntry={handleNewEntry}
        onSignOut={logOut}
        isSaving={isSaving}
        activeEntryTitle={activeEntry.title}
      />

      {/* Firestore Error Alert with Explicit Recovery */}
      {firestoreError && (
        <div id="firestore-error-banner" className="bg-red-950/90 border-b border-red-800/80 px-4 py-2.5 text-xs text-red-200 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="truncate">{firestoreError}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {failedEntryToRetry && (
              <button
                id="retry-save-button"
                onClick={handleRetrySave}
                disabled={isRetryingSave}
                className="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white rounded font-medium text-[11px] transition flex items-center gap-1.5"
              >
                {isRetryingSave ? 'Saving...' : 'Retry Save'}
              </button>
            )}
            <button
              onClick={() => setFirestoreError(null)}
              className="text-red-400 hover:text-red-200 px-1 text-sm font-semibold"
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main App Body with Sidebar + Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Toggle Button */}
        <button
          id="mobile-menu-button"
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden absolute bottom-4 left-4 z-30 p-3 bg-neutral-800 text-amber-400 rounded-full shadow-lg border border-neutral-700"
          title="Open History"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* History Sidebar */}
        <HistorySidebar
          entries={entries}
          selectedEntryId={activeEntry.id}
          onSelectEntry={(entry) => setSelectedEntryId(entry.id)}
          onDeleteEntry={handleDeleteEntry}
          isOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Workspace Canvas */}
        <main className="flex-1 flex flex-col h-full min-w-0">
          <ReflectionWorkspace
            key={activeEntry.id}
            entry={activeEntry}
            onUpdateEntry={handleUpdateEntry}
            isSaving={isSaving}
            onAutoSummarize={handleAutoSummarize}
            isSummarizing={isSummarizing}
          />
        </main>
      </div>
    </div>
  );
};
