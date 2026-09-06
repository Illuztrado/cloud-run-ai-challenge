export type UserRole = 'admin' | 'moderator' | 'user';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: UserRole;
  roleUpdatedAt?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AdminUserRecord {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  roleUpdatedAt?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AdminSystemMetrics {
  totalUsers: number;
  adminCount: number;
  moderatorCount: number;
  standardUserCount: number;
  estimatedEntriesCount: number;
  serverStatus: 'healthy' | 'degraded' | 'offline';
  geminiModelLadder: string[];
  firestoreStatus: 'connected' | 'error';
  lastCheckedAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorEmail: string;
  actorUid: string;
  targetUid: string;
  action: string;
  previousRole?: string;
  newRole: string;
  timestamp: string;
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

// ----------------------------------------------------
// Ride-Hailing Price Monitoring Types
// ----------------------------------------------------

export type RideHailingApp = 'Grab' | 'Angkas' | 'JoyRide' | 'Move It' | 'InDrive' | 'Taxi' | 'Other';
export type VehicleCategory = '4-wheel' | '2-wheel';

export interface RideMessage {
  id?: string;
  role: 'user' | 'model';
  content: string;
  timestamp?: string;
  imageUrl?: string;
}

export type ChatMessage = RideMessage;

export interface RideEntry {
  id: string;
  userId: string;
  rideService: RideHailingApp;
  vehicleType?: VehicleCategory;
  farePaid: number; // In Philippine Pesos (PHP ₱)
  pickupAddress: string;
  destinationAddress: string;
  tripDuration?: string; // Optional e.g., "35 mins"
  tripDistance?: string; // Optional e.g., "7.4 km"
  reviewText: string; // Default "None"
  receiptImage?: string; // Base64 data URL
  messages: RideMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunityRide {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string | null;
  rideService: RideHailingApp;
  vehicleType?: VehicleCategory;
  farePaid: number;
  pickupAddress: string;
  destinationAddress: string;
  tripDuration?: string;
  tripDistance?: string;
  reviewText: string; // Default "None"
  hasReceipt: boolean;
  createdAt: string;
}

export interface ExtractedRideInfo {
  rideService: RideHailingApp;
  vehicleType?: VehicleCategory;
  farePaid: number;
  pickupAddress: string;
  destinationAddress: string;
  tripDuration?: string;
  tripDistance?: string;
  reviewText: string;
  analysisNotes?: string;
}

export type CommunityTimeFilter = 'today' | 'week' | 'month' | 'all';

export interface CategoryAnalysis {
  category: VehicleCategory;
  title: string;
  totalTrips: number;
  averageFare: number;
  cheapestService: string;
  averageDuration: string;
  fareSummaryByApp: {
    service: string;
    avgFare: number;
    count: number;
    avgDuration?: string;
  }[];
  pricingAndSurgeTrends: string[];
  reviewInsights: string[];
  durationInsights: string;
  comparisonNarrative: string; // Comparison across similar vehicle types
}

export interface CommunitySummaryResult {
  period: CommunityTimeFilter;
  totalTrips: number;
  averageFare: number;
  cheapestService: string;
  fareSummaryByApp: {
    service: string;
    avgFare: number;
    count: number;
  }[];
  overviewSummary: string;
  briefAnalysis: string; // Concise executive summary for landing page and quick overview
  fourWheelAnalysis: CategoryAnalysis;
  twoWheelAnalysis: CategoryAnalysis;
  crossCategoryComparison: string;
  reviewInsights: string[];
  pricingTrends: string[];
  generatedAt: string;
  cachedAt?: string;
  expiresAt?: string;
  isCached?: boolean;
}

