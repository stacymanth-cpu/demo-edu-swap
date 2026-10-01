# Firebase security review

Reviewed 27 September 2026 against workspace source. The live Firebase project was not queried or changed.

## Current code state

- Session completion and cancellation use authenticated callable functions; credit transfers are calculated from server-side settings and committed transactionally.
- Workspace Firestore rules restrict private `users` documents to their owner and admins. Discovery data is projected into `publicProfiles` through an explicit field allowlist.
- The `publicProfiles` migration and restrictive rules are local changes only. Run `npm run migrate:public-profiles` with Firebase Admin credentials before deploying the updated frontend and rules.
- Storage deployment status has not been rechecked. The previous review reported Firebase Storage was not initialized and its rules were not deployed.

## Fixes on 30 September 2026 (not yet deployed)

- Sessions can only be created for an accepted match, with a future start time and a `createdBy` equal to the caller. Previously a user could create a past session with anyone and complete it to take their credits.
- Only the learner (the payer) can complete a session through `completeSession`.
- Only the recipient of a match request can accept it; either side can decline or withdraw while it is pending.
- Chat rooms require an accepted match (`matchId`). Chat messages are limited to known fields, and file and image URLs must point to Firebase Storage.
- Reviews use the id `{sessionId}_{reviewerId}`, need a completed session between the reviewer and the target, and must have a whole-number rating from 1 to 5.
- Notifications for matches, sessions and group calls and the rating recalculation now run in Cloud Functions (`onMatchCreated`, `onSessionCreated`, `onGroupCallRoomCreated`, `onCommentWritten`). The browser writes were being rejected by the rules.

Deploy order: `firebase deploy --only functions` first, then the Firestore rules and the frontend together. The old frontend cannot create sessions under the new rules.

## Required before production

1. Run the public-profile migration, deploy the updated frontend and Firestore rules in a coordinated release, then deploy the updated callable functions. Verify Explore, tutor profiles, matching, chat presence, and session completion against the deployed project.
2. Confirm Firebase Storage is initialized and deploy its rules. Verify uploads and reads for registration documents, chat files, profile photos, and introduction videos. Match-only video access still needs a trusted, visibility-aware URL flow; do not expose those URLs through public profiles.
3. Enable Firebase App Check for Firestore, Storage, Authentication, and callable functions.
4. Add server-side rate limits for match requests, reports, messages, and uploads. Client-side throttling is not an authorization boundary.
5. Route moderation reports through a trusted server endpoint, sanitize submitted text, retain an immutable audit log, and alert administrators for repeated reports.
6. Add end-to-end tests for signup, matching, scheduling, chat, uploads, permissions, and credit transfers.

## Client safeguards now present

- Chat, registration, profile-photo, and introduction-video uploads validate type and size before upload.
- Credit arithmetic validates finite, non-negative balances and positive whole-number transfers.
- Blocking and review removal require confirmation; session cancellation requires a reason.
- Reports and removed reviews are retained for moderation/audit rather than hard-deleted.

Do not treat client checks as authorization. The updated workspace rules have not been deployed or emulator-validated in this environment; do not rely on them for production until migration, validation, and deployment are complete.
