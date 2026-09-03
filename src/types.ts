export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface JournalMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string; // ISO string
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  summary?: string;
  tags: string[];
  mood?: string;
  messages: JournalMessage[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export type ReflectionMode = 'chat' | 'summarize' | 'brainstorm' | 'reflect' | 'action_plan';

export interface AISummaryResult {
  title: string;
  summary: string;
  tags: string[];
  mood: string;
}
