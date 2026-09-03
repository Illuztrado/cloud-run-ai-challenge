import React, { useState, useMemo } from 'react';
import { Search, Calendar, Tag, Trash2, BookOpen, MessageSquare, ChevronRight, X, Sparkles, Filter } from 'lucide-react';
import { JournalEntry } from '../types';

interface HistorySidebarProps {
  entries: JournalEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  entries,
  selectedEntryId,
  onSelectEntry,
  onDeleteEntry,
  isOpen,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach((entry) => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.summary && entry.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        entry.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTag = !selectedTag || (entry.tags && entry.tags.includes(selectedTag));

      return matchesSearch && matchesTag;
    });
  }, [entries, searchQuery, selectedTag]);

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { [key: string]: JournalEntry[] } = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Older: [],
    };

    filteredEntries.forEach((entry) => {
      const entryDate = new Date(entry.updatedAt || entry.createdAt);
      const isToday = entryDate.toDateString() === today.toDateString();
      const isYesterday = entryDate.toDateString() === yesterday.toDateString();
      const diffTime = Math.abs(today.getTime() - entryDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (isToday) {
        groups.Today.push(entry);
      } else if (isYesterday) {
        groups.Yesterday.push(entry);
      } else if (diffDays <= 7) {
        groups['This Week'].push(entry);
      } else {
        groups.Older.push(entry);
      }
    });

    return groups;
  }, [filteredEntries]);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-neutral-900 border-r border-neutral-800 w-80 max-w-full">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-neutral-200">Reflection History</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
            {entries.length}
          </span>
        </div>
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1 text-neutral-400 hover:text-neutral-200 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Filters */}
      <div className="p-3 border-b border-neutral-800 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            id="history-search-input"
            type="text"
            placeholder="Search entries, thoughts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Tag pills if any */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-2 py-0.5 rounded-md whitespace-nowrap transition ${
                selectedTag === null
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30 font-medium'
                  : 'bg-neutral-800/80 text-neutral-400 hover:bg-neutral-800 border border-neutral-700/50'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded-md whitespace-nowrap transition flex items-center gap-1 ${
                  selectedTag === tag
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30 font-medium'
                    : 'bg-neutral-800/80 text-neutral-400 hover:bg-neutral-800 border border-neutral-700/50'
                }`}
              >
                <span>#{tag}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-10 px-4">
            <BookOpen className="w-8 h-8 text-neutral-600 mx-auto mb-2 opacity-50" />
            <p className="text-xs text-neutral-400 font-medium">No reflections found</p>
            <p className="text-[11px] text-neutral-600 mt-1">
              {searchQuery ? 'Try clearing your search filters' : 'Start your first reflection with Gemini'}
            </p>
          </div>
        ) : (
          Object.entries(groupedEntries).map(([groupName, groupItems]) => {
            if (groupItems.length === 0) return null;
            return (
              <div key={groupName} className="space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 px-2 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  <span>{groupName}</span>
                </div>
                <div className="space-y-1">
                  {groupItems.map((entry) => {
                    const isSelected = entry.id === selectedEntryId;
                    const isConfirmingDelete = deleteConfirmId === entry.id;

                    return (
                      <div
                        key={entry.id}
                        id={`entry-item-${entry.id}`}
                        onClick={() => {
                          onSelectEntry(entry);
                          onCloseMobile();
                        }}
                        className={`group relative p-2.5 rounded-xl cursor-pointer transition border text-left ${
                          isSelected
                            ? 'bg-neutral-800/90 border-amber-500/40 shadow-sm'
                            : 'bg-neutral-950/40 hover:bg-neutral-800/50 border-neutral-800/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className={`text-xs font-medium truncate flex-1 ${
                              isSelected ? 'text-amber-200' : 'text-neutral-200'
                            }`}
                          >
                            {entry.title || 'Untitled Reflection'}
                          </h3>
                          <span className="text-[10px] text-neutral-500 flex-shrink-0 font-mono">
                            {formatDate(entry.updatedAt || entry.createdAt)}
                          </span>
                        </div>

                        {entry.summary ? (
                          <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                            {entry.summary}
                          </p>
                        ) : entry.messages.length > 0 ? (
                          <p className="text-[11px] text-neutral-500 line-clamp-1 mt-1 italic">
                            {entry.messages[0].content}
                          </p>
                        ) : null}

                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-800/40">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {entry.mood && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                {entry.mood}
                              </span>
                            )}
                            <span className="text-[10px] text-neutral-500 flex items-center gap-0.5">
                              <MessageSquare className="w-2.5 h-2.5" />
                              {entry.messages.length}
                            </span>
                          </div>

                          {/* Delete action */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center"
                          >
                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800">
                                <span className="text-[9px] text-red-300">Delete?</span>
                                <button
                                  onClick={() => {
                                    onDeleteEntry(entry.id);
                                    setDeleteConfirmId(null);
                                  }}
                                  className="text-[9px] font-bold text-red-400 hover:text-red-200 px-1"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-[9px] text-neutral-400 hover:text-neutral-200 px-1"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(entry.id)}
                                title="Delete reflection"
                                className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-red-400 rounded transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside id="history-sidebar-desktop" className="hidden md:block h-full">
        {sidebarContent}
      </aside>

      {/* Mobile drawer backdrop */}
      {isOpen && (
        <div
          id="history-sidebar-mobile-backdrop"
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        >
          <div
            id="history-sidebar-mobile-drawer"
            className="fixed inset-y-0 left-0 max-w-[85vw] z-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
