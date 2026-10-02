// ─── EduSwap Type Definitions ───────────────────────────────────

export interface User {
  uid: string;
  firstName?: string;
  lastName?: string;
  studentNumber?: string;
  mobileNumber?: string;
  studentStatusConfirmed?: boolean;
  termsAcceptedAt?: Date;
  displayName: string;
  email: string;
  photoUrl: string;
  university: string;
  bio: string;
  skillsTeach: string[];
  skillsLearn: string[];
  credits: number;
  rating: number;
  totalSessions: number;
  joinedAt: Date;
  isOnline: boolean;
  lastSeen?: Date | null;
  verifiedSkills?: string[];
  blockedUserIds?: string[];
  achievementIds?: string[];
  isAdmin?: boolean;
  accountStatus?: 'active' | 'suspended' | 'deactivated';
  studentVerified?: boolean;
  availability?: 'available' | 'teaching' | 'pending' | 'offline';
  skillLevels?: Record<string, 'Beginner' | 'Intermediate' | 'Advanced'>;
  introductionVideoUrl?: string;
  registrationDocumentPath?: string;
  registrationVerificationStatus?: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  /** How the student was verified: automatically by university email, or by an admin reviewing a document. */
  verificationMethod?: 'university_email' | 'document';
  verifiedEmailDomain?: string;
  learningGoals?: string;
  preferredTeachingStyle?: 'visual' | 'practical' | 'discussion' | 'structured';
  languages?: string[];
  sessionPreference?: 'remote' | 'in_person' | 'either';
  savedUserIds?: string[];
  hiddenUserIds?: string[];
  introductionVideoVisibility?: 'members' | 'matches' | 'private';
  notificationPreferences?: { inApp: boolean; email: boolean; sessionReminders: boolean; messages: boolean };
  weeklyAvailability?: WeeklyAvailability[];
}

export interface WeeklyAvailability {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start: string;
  end: string;
}

export interface SkillMatch {
  id: string;
  user1Id: string;
  user2Id: string;
  user1: User;
  user2: User;
  user1Teaches: string;
  user2Teaches: string;
  learnerId?: string;
  teacherId?: string;
  requestedAt?: Date;
  requestedSkill?: string;
  offeredSkill?: string;
  learningGoal?: string;
  meetingLink?: string;
  requestNotes?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

export interface BeforeSessionChecklist {
  scheduling: boolean;
  reminders: boolean;
  goals: boolean;
  profiles: boolean;
  confirmation: boolean;
}

export interface Session {
  id: string;
  matchId: string;
  teacherId: string;
  learnerId: string;
  teacherName: string;
  learnerName: string;
  skill: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  creditsExchanged: number;
  notes: string;
  meetingLink?: string;
  beforeSessionChecklist?: BeforeSessionChecklist;
  cancelledBy?: string;
  cancellationReason?: string;
  rescheduledFrom?: Date;
}

export type NotificationType = 'match_request' | 'message' | 'session_upcoming' | 'session_cancelled' | 'session_completed' | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
  link?: string;
}

export type ReportType = 'user' | 'session' | 'credits' | 'content';

export interface UserReport {
  id: string;
  reporterId: string;
  targetUserId?: string;
  sessionId?: string;
  type: ReportType;
  reason: string;
  details: string;
  status: 'open' | 'reviewing' | 'resolved';
  createdAt: Date;
}

export interface SkillVerification {
  id: string;
  userId: string;
  skill: string;
  method: 'certificate' | 'assessment' | 'admin_approval';
  evidenceUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetId?: string;
  details: string;
  createdAt: Date;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  createdBy: string;
  createdAt: Date;
}

export interface SystemSettings {
  id: string;
  creditsPerSession: number;
  verificationRequired: boolean;
  cancellationWindowHours: number;
  /** University email domains (e.g. "ump.ac.za") whose confirmed owners are verified automatically. */
  verifiedEmailDomains: string[];
}

export interface GroupCallRoom {
  id: string;
  hostId: string;
  title: string;
  participants: string[];
  createdAt: Date;
  status: 'open' | 'ended';
}

export interface ChatRoom {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string>;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: Record<string, number>;
  typingBy?: Record<string, boolean>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  imageUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  sharedNote?: {
    title: string;
    content: string;
  };
  timestamp: Date;
  isRead: boolean;
  deliveredAt?: Date;
  readAt?: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

export interface CallHistoryEntry {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  chatRoomId?: string;
  roomId?: string;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  durationLabel: string;
  status: 'ended' | 'missed';
  endedBy?: string;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  targetUserId?: string;
  text: string;
  rating: number;
  timestamp: Date;
  sessionId?: string;
  skill?: string;
  targetRole?: 'tutor' | 'learner';
  verifiedSession?: boolean;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'earned_teaching' | 'spent_learning' | 'welcome_bonus' | 'five_star_bonus';
  sessionId?: string;
  timestamp: Date;
  description: string;
}

export interface AiMatchRecommendation {
  user: User;
  score: number;
  commonTeach: string[];
  commonLearn: string[];
  summary: string;
  reasons: string[];
}

export interface AiSkillSuggestion {
  name: string;
  reason: string;
  confidence: number;
}

export interface University {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  totalUsers: number;
}

export type SkillCategory = 'Academic' | 'Technology' | 'Creative' | 'Languages' | 'Business' | 'Lifestyle';

export interface SkillInfo {
  name: string;
  category: SkillCategory;
  userCount: number;
  icon: string;
  description?: string;
  /** Set when an admin removes the skill; archived skills are hidden from students. */
  isArchived?: boolean;
}
