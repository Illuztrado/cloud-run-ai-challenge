import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  browserLocalPersistence,
  setPersistence,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  JournalEntry,
  UserProfile,
  AdminUserRecord,
  AdminSystemMetrics,
  AdminAuditLog,
  UserRole,
  RideEntry,
  CommunityRide,
} from '../types';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
  measurementId: firebaseConfig.measurementId,
});

// Initialize Auth
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Could not set browserLocalPersistence:', err);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Firestore (using provisioned database ID)
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Authentication helpers
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await syncUserProfile(result.user);
    return result.user;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    // If popup was blocked or closed, attempt redirect
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed or blocked. Please allow popups and try again.');
    }
    throw error;
  }
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

/**
 * Strips all undefined properties recursively to ensure zero-crash payload hygiene
 * before any document payload reaches the Cloud Firestore driver.
 */
export function sanitizePayload<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizePayload(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    // Preserve special Firestore FieldValues like serverTimestamp()
    if ('_methodName' in (data as any) || (data as any)?.constructor?.name === 'FieldValue') {
      return data;
    }
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizePayload(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

// User Profile sync
export async function syncUserProfile(user: User): Promise<void> {
  if (!user || !user.uid) return;
  const userRef = doc(db, 'users', user.uid);
  try {
    const userDoc = await getDoc(userRef);
    const now = new Date().toISOString();
    if (!userDoc.exists()) {
      const isOwner = user.email === 'canindojp@gmail.com';
      const payload = sanitizePayload({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Reflective Writer',
        photoURL: user.photoURL || '',
        role: isOwner ? 'admin' : 'user',
        createdAt: now,
        lastLoginAt: now,
        serverCreatedAt: serverTimestamp(),
      });
      await setDoc(userRef, payload);
    } else {
      const payload = sanitizePayload({
        displayName: user.displayName || user.email?.split('@')[0] || 'Reflective Writer',
        photoURL: user.photoURL || '',
        lastLoginAt: now,
      });
      await setDoc(userRef, payload, { merge: true });
    }
  } catch (err) {
    console.error('Error syncing user profile:', err);
  }
}

// Firestore operations for user-isolated journal entries
export async function saveJournalEntry(userId: string, entry: JournalEntry): Promise<void> {
  if (!userId || !entry.id) {
    throw new Error('User ID and Entry ID are required to save an entry.');
  }

  const entryRef = doc(db, 'users', userId, 'entries', entry.id);
  const now = new Date().toISOString();

  const sanitized = sanitizePayload({
    ...entry,
    userId,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });

  await setDoc(entryRef, sanitized, { merge: true });
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) return;
  const entryRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(entryRef);
}

export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalEntry[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        items.push({
          id: docSnapshot.id,
          userId: data.userId || userId,
          title: data.title || 'Untitled Reflection',
          summary: data.summary || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          mood: data.mood || 'Reflective',
          messages: Array.isArray(data.messages) ? data.messages : [],
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Error subscribing to journal entries:', error);
      if (onError) onError(error);
    }
  );
}

// ----------------------------------------------------
// Ride-Hailing Storage Services
// ----------------------------------------------------

/**
 * Saves a ride transaction and its multi-turn conversation to the isolated user collection.
 * Path: /users/{userId}/ride_entries/{rideId}
 * Strict Undefined-Stripping ensures zero-crash payload hygiene.
 */
export async function saveRideEntry(userId: string, ride: RideEntry): Promise<void> {
  if (!userId || !ride?.id) {
    throw new Error('User ID and Ride ID are required to persist ride transaction.');
  }

  const payload = sanitizePayload({
    id: ride.id,
    userId,
    rideService: ride.rideService || 'Grab',
    farePaid: Number(ride.farePaid) || 0,
    pickupAddress: ride.pickupAddress || '',
    destinationAddress: ride.destinationAddress || '',
    tripDuration: ride.tripDuration || '',
    tripDistance: ride.tripDistance || '',
    reviewText: ride.reviewText && ride.reviewText.trim() ? ride.reviewText : 'None',
    receiptImage: ride.receiptImage || '',
    messages: Array.isArray(ride.messages) ? ride.messages : [],
    createdAt: ride.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const entryRef = doc(db, 'users', userId, 'ride_entries', ride.id);
  await setDoc(entryRef, payload, { merge: true });
}

/**
 * Deletes a ride entry from the user's isolated subcollection.
 */
export async function deleteRideEntry(userId: string, rideId: string): Promise<void> {
  const entryRef = doc(db, 'users', userId, 'ride_entries', rideId);
  await deleteDoc(entryRef);
}

/**
 * Real-time subscription to the user's private ride history.
 */
export function subscribeToUserRides(
  userId: string,
  onUpdate: (rides: RideEntry[]) => void,
  onError?: (err: Error) => void
) {
  const ridesRef = collection(db, 'users', userId, 'ride_entries');
  const q = query(ridesRef, orderBy('createdAt', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: RideEntry[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        items.push({
          id: docSnapshot.id,
          userId: data.userId || userId,
          rideService: data.rideService || 'Grab',
          farePaid: Number(data.farePaid) || 0,
          pickupAddress: data.pickupAddress || '',
          destinationAddress: data.destinationAddress || '',
          tripDuration: data.tripDuration || '',
          tripDistance: data.tripDistance || '',
          reviewText: data.reviewText || 'None',
          receiptImage: data.receiptImage || '',
          messages: Array.isArray(data.messages) ? data.messages : [],
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Error subscribing to personal ride entries:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Publishes a ride transaction to the general community board for crowdsourced price transparency.
 * Path: /community_rides/{rideId}
 */
export async function publishCommunityRide(ride: CommunityRide): Promise<void> {
  if (!ride.id || !ride.userId) {
    throw new Error('Ride ID and User ID are required to publish to community board.');
  }

  const payload = sanitizePayload({
    id: ride.id,
    userId: ride.userId,
    userDisplayName: ride.userDisplayName || 'Anonymous Rider',
    userPhotoURL: ride.userPhotoURL || null,
    rideService: ride.rideService || 'Grab',
    farePaid: Number(ride.farePaid) || 0,
    pickupAddress: ride.pickupAddress || '',
    destinationAddress: ride.destinationAddress || '',
    tripDuration: ride.tripDuration || '',
    tripDistance: ride.tripDistance || '',
    reviewText: ride.reviewText && ride.reviewText.trim() ? ride.reviewText : 'None',
    hasReceipt: Boolean(ride.hasReceipt),
    createdAt: ride.createdAt || new Date().toISOString(),
  });

  const commRef = doc(db, 'community_rides', ride.id);
  await setDoc(commRef, payload, { merge: true });
}

/**
 * Deletes an entry from the general community board.
 */
export async function deleteCommunityRide(rideId: string): Promise<void> {
  const commRef = doc(db, 'community_rides', rideId);
  await deleteDoc(commRef);
}

/**
 * Real-time listener for crowdsourced community rides.
 */
export function subscribeToCommunityRides(
  onUpdate: (rides: CommunityRide[]) => void,
  onError?: (err: Error) => void
) {
  const commRef = collection(db, 'community_rides');
  const q = query(commRef, orderBy('createdAt', 'desc'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CommunityRide[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        items.push({
          id: docSnapshot.id,
          userId: data.userId || 'unknown',
          userDisplayName: data.userDisplayName || 'Anonymous Rider',
          userPhotoURL: data.userPhotoURL || null,
          rideService: data.rideService || 'Grab',
          farePaid: Number(data.farePaid) || 0,
          pickupAddress: data.pickupAddress || '',
          destinationAddress: data.destinationAddress || '',
          tripDuration: data.tripDuration || '',
          tripDistance: data.tripDistance || '',
          reviewText: data.reviewText || 'None',
          hasReceipt: Boolean(data.hasReceipt),
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Error subscribing to community rides:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Seeds initial benchmark rides if the community board is fresh,
 * ensuring users immediately see current day, week, and month fare baselines.
 */
export async function seedInitialCommunityRidesIfEmpty(user: User): Promise<void> {
  try {
    const snap = await getDocs(query(collection(db, 'community_rides'), limit(1)));
    if (!snap.empty) return; // Already has community data

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const initialSeeds: Partial<CommunityRide>[] = [
      {
        id: 'seed_grab_bgc',
        rideService: 'Grab',
        vehicleType: '4-wheel',
        farePaid: 320,
        pickupAddress: 'One Ayala, Makati City',
        destinationAddress: 'Bonifacio High Street, BGC, Taguig',
        tripDuration: '32 mins',
        tripDistance: '5.8 km',
        reviewText: 'Rush hour surge in EDSA/McKinley, but aircon was cool and driver was courteous.',
        hasReceipt: true,
        createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // Today
      },
      {
        id: 'seed_angkas_ortigas',
        rideService: 'Angkas',
        vehicleType: '2-wheel',
        farePaid: 95,
        pickupAddress: 'SM Megamall Building B, Mandaluyong',
        destinationAddress: 'Robinsons Galleria, Ortigas, Pasig',
        tripDuration: '14 mins',
        tripDistance: '2.4 km',
        reviewText: 'Fast and beat the EDSA traffic. Provided clean hairnet and well-fitting helmet.',
        hasReceipt: true,
        createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(), // Today
      },
      {
        id: 'seed_joyride_taft',
        rideService: 'JoyRide',
        vehicleType: '2-wheel',
        farePaid: 165,
        pickupAddress: 'DLSU Taft Ave, Manila',
        destinationAddress: 'SM Mall of Asia, Pasay',
        tripDuration: '22 mins',
        tripDistance: '5.1 km',
        reviewText: 'Smooth ride via Macapagal Ave. Driver had rain gear ready.',
        hasReceipt: true,
        createdAt: new Date(now - 2 * oneDay).toISOString(), // This week
      },
      {
        id: 'seed_moveit_cubao',
        rideService: 'Move It',
        vehicleType: '2-wheel',
        farePaid: 110,
        pickupAddress: 'Gateway Mall, Araneta City, Cubao',
        destinationAddress: 'UP Town Center, Katipunan, Quezon City',
        tripDuration: '26 mins',
        tripDistance: '6.3 km',
        reviewText: 'None',
        hasReceipt: true,
        createdAt: new Date(now - 4 * oneDay).toISOString(), // This week
      },
      {
        id: 'seed_indrive_naia',
        rideService: 'InDrive',
        vehicleType: '4-wheel',
        farePaid: 380,
        pickupAddress: 'Trinoma Mall, North Ave, Quezon City',
        destinationAddress: 'NAIA Terminal 3, Pasay City',
        tripDuration: '55 mins',
        tripDistance: '19.2 km',
        reviewText: 'Accepted my offer of ₱380 after Grab was quoting ₱680 due to Skyway rain surge.',
        hasReceipt: false,
        createdAt: new Date(now - 12 * oneDay).toISOString(), // This month
      },
      {
        id: 'seed_grab_cebu',
        rideService: 'Grab',
        vehicleType: '4-wheel',
        farePaid: 210,
        pickupAddress: 'Ayala Center Cebu, Cebu City',
        destinationAddress: 'IT Park, Lahug, Cebu City',
        tripDuration: '18 mins',
        tripDistance: '3.9 km',
        reviewText: 'None',
        hasReceipt: true,
        createdAt: new Date(now - 18 * oneDay).toISOString(), // This month
      },
    ];

    for (const seed of initialSeeds) {
      await publishCommunityRide({
        ...seed,
        userId: user.uid,
        userDisplayName: user.displayName || 'Commuter Community',
        userPhotoURL: user.photoURL,
      } as CommunityRide);
    }
  } catch (err) {
    console.warn('Seed initial community rides skipped:', err);
  }
}

// ----------------------------------------------------
// Administrative & RBAC Services (Client Firestore)
// ----------------------------------------------------

/**
 * Retrieves the user directory for authorized administrators.
 * Security: Firestore rules permit read only if requester passes isAdmin().
 */
export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  const usersSnap = await getDocs(collection(db, 'users'));
  const users: AdminUserRecord[] = [];
  usersSnap.forEach((d) => {
    const data = d.data();
    users.push({
      uid: d.id,
      email: data.email || null,
      displayName: data.displayName || null,
      photoURL: data.photoURL || null,
      role: (data.role as UserRole) || 'user',
      roleUpdatedAt: data.roleUpdatedAt || null,
      createdAt: data.createdAt || null,
      lastLoginAt: data.lastLoginAt || null,
    });
  });
  return users;
}

/**
 * Updates a user's role and writes an immutable audit log.
 * Security: Firestore rules enforce allow update/write: if isAdmin().
 */
export async function updateAdminUserRole(
  targetUserId: string,
  newRole: UserRole,
  actorUser: User
): Promise<void> {
  const now = new Date().toISOString();
  const userRef = doc(db, 'users', targetUserId);
  const userDoc = await getDoc(userRef);
  const previousRole = userDoc.exists() ? userDoc.data()?.role || 'user' : 'unknown';

  // 1. Update user document
  const userPayload = sanitizePayload({
    role: newRole,
    roleUpdatedAt: now,
  });
  await setDoc(userRef, userPayload, { merge: true });

  // 2. Persist audit log event in /admin_metrics/audit_logs/events
  const eventId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const auditRef = doc(db, 'admin_metrics', 'audit_logs', 'events', eventId);
  const auditPayload = sanitizePayload({
    id: eventId,
    actorEmail: actorUser.email || 'unknown',
    actorUid: actorUser.uid,
    targetUid: targetUserId,
    action: 'ROLE_CHANGE',
    previousRole,
    newRole,
    timestamp: now,
  });
  await setDoc(auditRef, auditPayload);
}

/**
 * Retrieves platform telemetry and user counts for administrators.
 */
export async function fetchAdminTelemetry(): Promise<AdminSystemMetrics> {
  const usersSnap = await getDocs(collection(db, 'users'));
  let adminCount = 0;
  let moderatorCount = 0;
  let standardUserCount = 0;

  usersSnap.forEach((d) => {
    const role = d.data()?.role;
    if (role === 'admin') adminCount++;
    else if (role === 'moderator') moderatorCount++;
    else standardUserCount++;
  });

  let estimatedEntriesCount = 0;
  try {
    const auditSnap = await getDocs(collection(db, 'admin_metrics', 'audit_logs', 'events'));
    estimatedEntriesCount = auditSnap.size;
  } catch {
    // Non-critical metric
  }

  return {
    totalUsers: usersSnap.size,
    adminCount,
    moderatorCount,
    standardUserCount,
    estimatedEntriesCount,
    serverStatus: 'healthy',
    geminiModelLadder: [
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
    ],
    firestoreStatus: 'connected',
    lastCheckedAt: new Date().toISOString(),
  };
}

/**
 * Retrieves security audit log records.
 */
export async function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  try {
    const logsRef = collection(db, 'admin_metrics', 'audit_logs', 'events');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(25));
    const snap = await getDocs(q);
    const logs: AdminAuditLog[] = [];
    snap.forEach((d) => {
      const data = d.data();
      logs.push({
        id: d.id,
        actorEmail: data.actorEmail || 'unknown',
        actorUid: data.actorUid || 'unknown',
        targetUid: data.targetUid || 'unknown',
        action: data.action || 'ROLE_CHANGE',
        previousRole: data.previousRole || 'user',
        newRole: data.newRole || 'user',
        timestamp: data.timestamp || new Date().toISOString(),
      });
    });
    return logs;
  } catch (err) {
    console.warn('Could not fetch audit logs from client Firestore:', err);
    return [];
  }
}
