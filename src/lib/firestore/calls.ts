// Group call rooms, incoming direct calls and call history.
import { collection, addDoc, doc, getDocs, query, where, onSnapshot, serverTimestamp, updateDoc, Timestamp, type DocumentData, type QueryDocumentSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { CallHistoryEntry, GroupCallRoom } from '../../types';
import { toDate } from './shared';

export async function createGroupCallRoom(hostId: string, title: string, participantIds: string[]): Promise<string> {
  const docRef = await addDoc(collection(db, 'groupCallRooms'), {
    hostId,
    title: title.trim() || 'EduSwap group session',
    participants: Array.from(new Set([hostId, ...participantIds])),
    createdAt: Timestamp.fromDate(new Date()),
    status: 'open',
  });
  // The onGroupCallRoomCreated Cloud Function sends the invitations.
  return docRef.id;
}

/** Close a group call for everyone. Only the host may do this (see firestore.rules). */
export async function endGroupCallRoom(roomId: string): Promise<void> {
  await updateDoc(doc(db, 'groupCallRooms', roomId), { status: 'ended', endedAt: serverTimestamp() });
}

/** Listen to one group-call room, so participants leave when the host ends it. */
export function subscribeGroupCallRoom(
  roomId: string,
  callback: (room: GroupCallRoom | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'groupCallRooms', roomId), (snap) => {
    const data = snap.data();
    callback(data ? { ...data, id: snap.id, createdAt: toDate(data.createdAt) } as GroupCallRoom : null);
  }, (error) => {
    console.error('Group call room listener failed:', error);
  });
}

/** Listen to group-call rooms that the current student has been invited to. */
export function subscribeGroupCallRooms(
  uid: string,
  callback: (rooms: GroupCallRoom[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'groupCallRooms'),
    where('participants', 'array-contains', uid)
  );

  return onSnapshot(q, (snap) => {
    const rooms = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: toDate(data.createdAt),
        } as GroupCallRoom;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(rooms);
  });
}

export interface IncomingCall {
  roomId: string;
  callerId: string;
  callerName: string;
  callerPhoto: string;
  callType: 'audio' | 'video';
  chatRoomId: string | null;
  sessionId: string | null;
  createdAt: Date;
}

// Calls older than this are treated as abandoned (for example, the caller closed the tab).
const INCOMING_CALL_MAX_AGE_MS = 60_000;

function callsForUserQuery(uid: string) {
  return query(collection(db, 'videoCalls'), where('participants', 'array-contains', uid));
}

/** Calls started by someone else that are still ringing, newest first. */
function toIncomingCalls(docs: QueryDocumentSnapshot[], uid: string): IncomingCall[] {
  const now = Date.now();
  return docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .filter(({ data }) => data.creatorId !== uid && !data.answer && !data.endedAt && data.createdAt)
    .map(({ id, data }) => ({
      roomId: id,
      callerId: data.creatorId,
      callerName: data.callerName || 'Someone',
      callerPhoto: data.callerPhoto || '',
      callType: data.callType === 'audio' ? 'audio' : 'video',
      chatRoomId: data.chatRoomId || null,
      sessionId: data.sessionId || null,
      createdAt: toDate(data.createdAt),
    } as IncomingCall))
    .filter((call) => now - call.createdAt.getTime() < INCOMING_CALL_MAX_AGE_MS)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** The call the other person in this chat has already started and is waiting on, if any. */
export async function findWaitingCallForChat(uid: string, chatRoomId: string): Promise<IncomingCall | null> {
  const snap = await getDocs(callsForUserQuery(uid));
  return toIncomingCalls(snap.docs, uid).find((call) => call.chatRoomId === chatRoomId) || null;
}

/** Listen to direct calls that name this user and are still waiting for an answer. */
export function subscribeIncomingCalls(
  uid: string,
  callback: (calls: IncomingCall[]) => void
): Unsubscribe {
  return onSnapshot(callsForUserQuery(uid), (snap) => {
    callback(toIncomingCalls(snap.docs, uid));
  }, (error) => {
    console.error('Incoming call listener failed:', error);
  });
}

/** Decline an incoming call; the caller's room listener ends the call on their side. */
export async function declineIncomingCall(roomId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'videoCalls', roomId), {
    endedAt: serverTimestamp(),
    endedBy: uid,
  });
}

export async function createCallHistoryEntry(data: Omit<CallHistoryEntry, 'id'>): Promise<string> {
  const payload: DocumentData = {
    ...data,
    startedAt: Timestamp.fromDate(data.startedAt instanceof Date ? data.startedAt : new Date()),
    endedAt: Timestamp.fromDate(data.endedAt instanceof Date ? data.endedAt : new Date()),
  };
  const docRef = await addDoc(collection(db, 'callHistory'), payload);
  return docRef.id;
}

export function subscribeCallHistory(
  uid: string,
  callback: (entries: CallHistoryEntry[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'callHistory'),
    where('participants', 'array-contains', uid)
  );

  return onSnapshot(q, (snap) => {
    const entries = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          startedAt: toDate(data.startedAt),
          endedAt: toDate(data.endedAt),
        } as CallHistoryEntry;
      })
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 20);

    callback(entries);
  });
}
