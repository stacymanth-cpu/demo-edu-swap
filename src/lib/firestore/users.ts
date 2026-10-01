// User profiles and admin account management.
import { collection, doc, getDoc, getDocs, onSnapshot, Timestamp, writeBatch, runTransaction, type DocumentData, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { User } from '../../types';
import { writeAuditLog } from './admin';
import { createNotification } from './notifications';
import { mapUserData, publicProfilePayload } from './shared';

export async function getUser(uid: string): Promise<User | null> {
  const includePrivateFields = auth.currentUser?.uid === uid;
  if (includePrivateFields) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? mapUserData(snap.data(), snap.id, true) : null;
  }

  try {
    const publicProfile = await getDoc(doc(db, 'publicProfiles', uid));
    if (publicProfile.exists()) return mapUserData(publicProfile.data(), publicProfile.id, false);
  } catch {
    // Older deployments may not have publicProfiles or its rules yet.
  }

  // Other students' private records are readable only by admins, so for a user with no
  // public profile this read is refused; treat that as "profile unavailable".
  const legacyProfile = await getDoc(doc(db, 'users', uid)).catch(() => null);
  if (!legacyProfile) return null;
  return legacyProfile.exists()
    ? mapUserData(legacyProfile.data(), legacyProfile.id, false)
    : null;
}

/** Subscribe to the complete current user profile, including admin review changes. */
export function subscribeUser(uid: string, callback: (user: User | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), snapshot => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(mapUserData(snapshot.data(), snapshot.id, true));
  });
}

export async function createUser(user: User): Promise<void> {
  const payload: DocumentData = {
    ...user,
    joinedAt: Timestamp.fromDate(user.joinedAt),
  };
  if (user.lastSeen instanceof Date) {
    payload.lastSeen = Timestamp.fromDate(user.lastSeen);
  }
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', user.uid), payload);
  batch.set(doc(db, 'publicProfiles', user.uid), publicProfilePayload(user));
  await batch.commit();
}

export async function updateUser(uid: string, data: Partial<User>): Promise<void> {
  const updateData: DocumentData = { ...data };
  if (data.joinedAt) {
    updateData.joinedAt = Timestamp.fromDate(data.joinedAt);
  }
  if (data.lastSeen instanceof Date) {
    updateData.lastSeen = Timestamp.fromDate(data.lastSeen);
  }
  const userRef = doc(db, 'users', uid);
  const publicProfileRef = doc(db, 'publicProfiles', uid);
  await runTransaction(db, async transaction => {
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists()) throw new Error('User profile not found.');
    transaction.update(userRef, updateData);
    transaction.set(publicProfileRef, publicProfilePayload({
      ...userSnapshot.data(),
      ...updateData,
      uid,
    } as Partial<User>));
  });
}

export async function getPublicUsers(): Promise<User[]> {
  try {
    const profiles = await getDocs(collection(db, 'publicProfiles'));
    if (profiles.docs.length > 0) {
      return profiles.docs.map(profile => mapUserData(profile.data(), profile.id, false));
    }
  } catch {
    // Older deployments may not have publicProfiles or its rules yet.
  }

  const legacyProfiles = await getDocs(collection(db, 'users'));
  return legacyProfiles.docs.map(profile => mapUserData(profile.data(), profile.id, false));
}

export async function getAllUsers(): Promise<User[]> {
  return getPublicUsers();
}

/** Non-empty when a registration document exists, whether in Firestore chunks or legacy Storage. */
function getRegistrationDocumentLabel(data: DocumentData | undefined): string {
  if (data?.storage === 'firestore' && data.chunkCount > 0) return data.fileName || 'Registration document';
  return data?.storagePath || '';
}

export async function getAdminUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(user => mapUserData(user.data(), user.id, true));
  return Promise.all(users.map(async user => {
    const registration = await getDoc(doc(db, 'privateRegistrationDocuments', user.uid));
    return {
      ...user,
      registrationDocumentPath: getRegistrationDocumentLabel(registration.data()),
    };
  }));
}

/** Keep the admin student queue current when documents or review states change. */
export function subscribeAdminUsers(callback: (users: User[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'users'), snapshot => {
    void Promise.all(snapshot.docs.map(async userDoc => {
      const data = userDoc.data();
      const registration = await getDoc(doc(db, 'privateRegistrationDocuments', userDoc.id));
      return {
        ...mapUserData(data, userDoc.id, true),
        registrationDocumentPath: getRegistrationDocumentLabel(registration.data()),
      } as User;
    })).then(callback).catch(error => console.error('Failed to load admin registration documents:', error));
  });
}

export async function adminUpdateUserStatus(adminId: string, userId: string, accountStatus: User['accountStatus'], studentVerified?: boolean): Promise<void> {
  const updates: Partial<User> = { accountStatus };
  if (studentVerified !== undefined) updates.studentVerified = studentVerified;
  await updateUser(userId, updates);
  await writeAuditLog({ adminId, action: 'user_status_updated', targetId: userId, details: JSON.stringify(updates) });
}

export async function adminReviewStudentRegistration(adminId: string, userId: string, status: User['registrationVerificationStatus']): Promise<void> {
  await updateUser(userId, {
    registrationVerificationStatus: status,
    studentVerified: status === 'approved',
  });
  await writeAuditLog({ adminId, action: 'registration_reviewed', targetId: userId, details: status || 'not_submitted' });

  // Tell the student; the review itself already succeeded, so a failed notice is only logged.
  if (status === 'approved' || status === 'rejected') {
    await createNotification({
      userId,
      type: 'system',
      title: status === 'approved' ? 'Student verification approved' : 'Student verification not approved',
      body: status === 'approved'
        ? 'Your proof of registration was approved. You are now a verified student and can accept tutor bookings.'
        : 'Your proof of registration could not be approved. Please upload a clear, current registration document from your Profile.',
      read: false,
      createdAt: new Date(),
      link: '/profile',
    }).catch(error => console.error('Failed to notify student about registration review:', error));
  }
}
