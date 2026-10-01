import { Phone, PhoneMissed, UsersRound } from 'lucide-react';
import { formatHistoryDateTime, getCallPartnerName } from '../../lib/callUtils';
import type { CallHistoryEntry, GroupCallRoom } from '../../types';

interface CallActivityPanelProps {
  groupCallRooms: GroupCallRoom[];
  callHistory: CallHistoryEntry[];
  currentUserId: string | undefined;
  onStartGroupCall: () => void;
  onJoinGroupCall: (room: GroupCallRoom) => void;
}

/** Group call rooms the user belongs to, followed by their recent call history. */
export function CallActivityPanel({ groupCallRooms, callHistory, currentUserId, onStartGroupCall, onJoinGroupCall }: CallActivityPanelProps) {
  const openRooms = groupCallRooms.filter(room => room.status === 'open');

  return (
    <div className="vc-activity">
      <section className="vc-card">
        <div className="vc-card-heading">
          <div><h2>Group calls</h2><p>Rooms you host or were invited to.</p></div>
          <button type="button" className="vc-btn vc-btn-ghost" onClick={onStartGroupCall}><UsersRound size={16} /> New</button>
        </div>
        {openRooms.length === 0 ? (
          <p className="vc-empty">No open group calls. Start one from your Profile after connecting with students.</p>
        ) : (
          <ul className="vc-list">
            {openRooms.map(room => (
              <li key={room.id} className="vc-list-item">
                <span className="vc-list-icon group"><UsersRound size={16} /></span>
                <span className="vc-list-text"><strong>{room.title}</strong><small>{room.participants.length} participants · {formatHistoryDateTime(room.createdAt)}</small></span>
                <button type="button" className="vc-btn vc-btn-primary vc-btn-sm" onClick={() => onJoinGroupCall(room)}>Join</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="vc-card">
        <div className="vc-card-heading"><div><h2>Recent calls</h2><p>Your latest direct calls.</p></div></div>
        {callHistory.length === 0 ? (
          <p className="vc-empty">No calls yet. Calls you make or receive will appear here.</p>
        ) : (
          <ul className="vc-list">
            {callHistory.map(entry => {
              const missed = entry.status === 'missed';
              return (
                <li key={entry.id} className="vc-list-item">
                  <span className={`vc-list-icon ${missed ? 'missed' : 'ended'}`}>{missed ? <PhoneMissed size={16} /> : <Phone size={16} />}</span>
                  <span className="vc-list-text">
                    <strong>{getCallPartnerName(entry, currentUserId)}</strong>
                    <small>{formatHistoryDateTime(entry.startedAt)}</small>
                  </span>
                  <span className={`vc-list-meta ${missed ? 'missed' : ''}`}>{missed ? 'Missed' : entry.durationLabel}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
