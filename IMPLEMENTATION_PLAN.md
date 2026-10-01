# Add Firebase Backend & Firestore Database to EduSwap

> Historical plan: Firebase Authentication, Firestore-backed feature pages, and callable session-credit functions are now implemented. For the current public-profile migration and deployment requirements, see `README.md` and `SECURITY_REVIEW.md`.

Replace the mock/demo data layer with **Firebase Authentication** (real login/signup) and **Cloud Firestore** (real-time database) so the app is fully functional with persistent data.

## User Review Required

> [!IMPORTANT]
> **Firebase Project Required**: You need a Firebase project set up. I'll create a placeholder config file — you'll need to paste your own Firebase credentials from the [Firebase Console](https://console.firebase.google.com/).
> 
> Steps to get credentials:
> 1. Go to Firebase Console → Create a new project (or use existing)
> 2. Add a Web app → Copy the `firebaseConfig` object
> 3. Enable **Authentication** → Email/Password sign-in method
> 4. Enable **Cloud Firestore** → Start in test mode

> [!WARNING]
> **Breaking Change**: After this change, the app will require a real Firebase project. The demo "any email works" login will be removed. Users must create real accounts.

## Proposed Changes

### Firebase Configuration

#### [NEW] [firebase.ts](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/lib/firebase.ts)
- Initialize Firebase app with config
- Export `auth` (Firebase Auth) and `db` (Firestore) instances
- Placeholder config that user fills in with their Firebase project credentials

---

### Authentication Layer

#### [MODIFY] [AuthContext.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/context/AuthContext.tsx)
- Replace mock `login()` with `signInWithEmailAndPassword()` from Firebase Auth
- Replace mock `signup()` with `createUserWithEmailAndPassword()` + create user doc in Firestore
- Replace mock `logout()` with `signOut()` from Firebase Auth
- Add `onAuthStateChanged()` listener so auth persists across page refreshes (no more re-login)
- On login, fetch user profile from Firestore `users/{uid}` collection
- `updateProfile()` will write to Firestore

#### [MODIFY] [ProtectedRoute.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/components/ProtectedRoute.tsx)
- Add a loading state (spinner) while Firebase auth initializes, so routes don't flash to login

#### [MODIFY] [LoginPage.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/pages/LoginPage.tsx)
- Remove the "Demo: Use any email & password" hint
- Show Firebase auth error messages (e.g., "wrong password", "user not found")

#### [MODIFY] [SignUpPage.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/pages/SignUpPage.tsx)
- Show Firebase auth error messages (e.g., "email already in use")

---

### Firestore Data Services

#### [NEW] [firestoreService.ts](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/lib/firestoreService.ts)
A centralized service module with functions to read/write Firestore data:

| Function | Firestore Collection | Description |
|---|---|---|
| `getUser(uid)` | `users` | Fetch a user profile |
| `updateUser(uid, data)` | `users` | Update user profile fields |
| `getAllUsers()` | `users` | Fetch all users (for Explore page) |
| `getMatches(uid)` | `matches` | Fetch matches for a user |
| `createMatch(data)` | `matches` | Create a new match request |
| `updateMatch(id, status)` | `matches` | Accept/decline a match |
| `getSessions(uid)` | `sessions` | Fetch sessions for a user |
| `createSession(data)` | `sessions` | Create a new session |
| `updateSession(id, data)` | `sessions` | Complete/cancel a session |
| `getChatRooms(uid)` | `chatRooms` | Fetch user's chat rooms |
| `getChatMessages(roomId)` | `chatMessages/{roomId}/messages` | Fetch messages (sub-collection) |
| `sendMessage(roomId, msg)` | `chatMessages/{roomId}/messages` | Send a new message |
| `getSkillsCatalog()` | `skillsCatalog` | Fetch skills catalog |
| `getTransactions(uid)` | `transactions` | Fetch credit history |

---

### Firestore Seeding Script

#### [NEW] [seedFirestore.ts](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/scripts/seedFirestore.ts)
- A one-time script that takes the existing mock data and writes it to Firestore collections
- Run via `npx tsx src/scripts/seedFirestore.ts` to populate the database initially
- This ensures you have the same demo data to work with, but now it's in Firestore

---

### Page Updates (Consume Firestore instead of mock data)

#### [MODIFY] [HomePage.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/pages/HomePage.tsx)
- Fetch sessions, users, skills catalog from Firestore on mount
- Add loading states while data loads

#### [MODIFY] [ExplorePage.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/pages/ExplorePage.tsx)
- Fetch skills catalog and users from Firestore
- Add loading states

#### [MODIFY] [MatchesPage.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/pages/MatchesPage.tsx)
- Fetch matches from Firestore
- Accept/decline writes to Firestore

#### [MODIFY] [SessionsPage.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/pages/SessionsPage.tsx)
- Fetch sessions from Firestore
- Complete/cancel writes to Firestore

#### [MODIFY] [ChatPage.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/pages/ChatPage.tsx)
- Fetch chat rooms and messages from Firestore
- Send messages writes to Firestore
- Use `onSnapshot()` for real-time message updates

#### [MODIFY] [ProfilePage.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/pages/ProfilePage.tsx)
- Fetch user profile, transactions, and comments from Firestore

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/components/Sidebar.tsx)
- Unread chat count from Firestore instead of hardcoded "3"

---

### Data Layer

#### [KEEP] [mockData.ts](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/data/mockData.ts)
- Keep this file as reference data — used by the seed script
- Pages will no longer import from it directly

#### [KEEP] [types/index.ts](file:///c:/Users/User/OneDrive/Desktop/antigravity_projects/eduswap-web/src/types/index.ts)
- Types remain the same; they already match the Firestore document structure

---

## Firestore Database Structure

```
├── users/{uid}
│   ├── displayName, email, photoUrl, university, bio
│   ├── skillsTeach[], skillsLearn[]
│   ├── credits, rating, totalSessions, joinedAt, isOnline
│
├── matches/{matchId}
│   ├── user1Id, user2Id, user1Teaches, user2Teaches
│   ├── status ("pending" | "accepted" | "declined")
│   ├── createdAt
│
├── sessions/{sessionId}
│   ├── matchId, teacherId, learnerId, skill
│   ├── scheduledAt, durationMinutes, teamsLink
│   ├── status, creditsExchanged, notes
│
├── chatRooms/{roomId}
│   ├── participants[], participantNames, lastMessage, lastMessageAt
│   └── messages (sub-collection)
│       └── {messageId}: senderId, text, timestamp, isRead
│
├── skillsCatalog/{skillId}
│   ├── name, category, userCount, icon
│
├── transactions/{txId}
│   ├── userId, amount, type, description, timestamp
│
├── universities/{uniId}
│   ├── name, domain, logoUrl, totalUsers
│
└── comments/{commentId}
    ├── userId, userName, text, rating, timestamp
```

## Open Questions

> [!IMPORTANT]
> **Do you already have a Firebase project?** If yes, please share the config values. If not, I'll guide you through creating one.

> [!NOTE]
> The `skillsCatalog` icons were just changed to Lucide React components. Since React components can't be stored in Firestore, I'll store the icon as a string key (e.g., `"Code"`, `"BrainCircuit"`) in the database and map it to the Lucide component on the frontend.

## Verification Plan

### Automated Tests
- Run `npm run build` to verify TypeScript compilation
- Verify dev server starts without errors

### Manual Verification
1. Open browser → Signup page → Create a new account → Verify user appears in Firebase Console
2. Login page → Sign in with created account → Verify redirect to Home
3. Explore page → Verify skills and users load from Firestore
4. Matches page → Accept/decline → Verify changes persist in Firestore
5. Chat page → Send message → Verify it appears in Firestore
6. Profile page → Verify user data loads from Firestore
7. Refresh page → Verify user stays logged in (auth persistence)
