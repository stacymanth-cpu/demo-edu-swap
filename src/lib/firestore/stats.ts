// Public activity and performance summaries, written by the EduSwap server (server/profileStats.ts).
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { ProfileStats } from '../../types';

/** Live summary for a student; null until the server has computed one. */
export function subscribeProfileStats(uid: string, callback: (stats: ProfileStats | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'publicStats', uid),
    snapshot => callback(snapshot.exists() ? (snapshot.data() as ProfileStats) : null),
    () => callback(null),
  );
}
