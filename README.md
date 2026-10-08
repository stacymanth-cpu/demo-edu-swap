# eduswap-web

EduSwap is a React + TypeScript + Vite web app for students to exchange skills, connect with peers, and manage learning sessions.

## Local setup

```bash
npm install
npm run dev
```

Signing in also needs the EduSwap server (login PINs and group-call tokens) running
in a second terminal; see [LiveKit configuration](#livekit-configuration):

```bash
npm run livekit:server
```

## Firebase Storage CORS

Browser uploads to Firebase Storage require the local development origins to be allowed by the bucket's CORS policy. With Google Cloud CLI installed and authenticated, apply the included policy with:

```bash
gcloud storage buckets update gs://eduswap-5e9ed.firebasestorage.app --cors-file=storage.cors.json
```

Before applying this policy to a deployed app, add its origin to `storage.cors.json`. Storage security rules still control which users may read or write each file.

## Testing

```bash
npm test
```

Firestore security rules tests run against the Firestore emulator under a `demo-eduswap` project, so they never touch real data. They need Java 21 or later on your `PATH`:

```bash
npm run test:rules
```

Run them after any change to `firestore.rules`.

Browser tests sign in (login PIN included), search Explore, send and accept a match,
chat between two students, complete a session and check that credits move once. They
start the Auth and Firestore emulators, the app on port 5199 and the PIN server on port
8799, all under `demo-eduswap`, so they never touch real data. They also need Java 21:

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

Screenshots and traces of failed tests are saved in `e2e/.output/`.

## Build

```bash
npm run build
```

## Firestore seeding

Seed the full demo dataset:

```bash
npm run seed
```

Seed only the remaining collections (skills catalog, transactions, comments):

```bash
npm run seed:remaining
```

Migrate existing user profiles to ensure skill fields are present:

```bash
npm run migrate:users
```

Before deploying the public-profile privacy changes, migrate existing users with
Firebase Admin credentials. The migration is safe to rerun and copies only the
allowlisted discovery fields to `publicProfiles`:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:/secure/path/firebase-service-account.json'
npm run migrate:public-profiles
```

Run this migration before deploying the updated frontend and `firestore.rules`.
The new client reads discovery profiles from `publicProfiles`, while the rules
restrict `users` documents to their owner and admins.

Deploy Firebase security rules after initializing Firestore and Storage:

```bash
npm run deploy:rules
```

Move existing registration documents out of public user profiles and rotate their old download tokens:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:/secure/path/firebase-service-account.json'
npm run migrate:registration-documents
```

Run this migration before relying on the new admin-only document access rules.

Admin access is controlled by the Firebase Auth `admin` custom claim. Do not use
the `users.isAdmin` profile field as an authorization mechanism.

Promote an existing Firebase Auth account to the owner/admin role from a trusted
environment with Firebase Admin credentials:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:/secure/path/firebase-service-account.json'
npm run promote:owner -- stacymanth@gmail.com
```

The account must sign out and sign in again after promotion so Firebase refreshes
the custom claim.

## Session credits

The app runs on the free Spark plan without Cloud Functions. Completing a session
moves credits from the learner to the teacher in a single Firestore transaction
(`src/lib/firestore/credits.ts`), and `firestore.rules` checks every write: only
the learner can complete, only after the start time, exactly the configured amount,
once, and never below zero. The amount comes from the admin setting
`settings/platform.creditsPerSession` (default 10), not from the session document.

The `functions/` folder is no longer used by the app.

## Notes

- The app uses Firebase Firestore and Authentication.
- Skills are now captured at signup and used for matching in Explore.

## LiveKit configuration

EduSwap uses LiveKit for authenticated group calls. Copy `.env.example` to `.env.local`, then replace the LiveKit placeholders with values from your own LiveKit Cloud project:

```env
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
VITE_LIVEKIT_TOKEN_ENDPOINT=http://localhost:8787/api/livekit/token
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_TOKEN_PORT=8787
APP_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
GOOGLE_APPLICATION_CREDENTIALS=C:/secure/path/firebase-service-account.json
```

The API secret and Firebase service-account file must remain server-only. Start the app and token server in separate terminals:

```powershell
npm run dev
npm run livekit:server
```

The token endpoint verifies the Firebase login and confirms that the user belongs to the requested EduSwap group-call room before issuing a short-lived LiveKit token.

The same server emails the 6-digit login PIN asked for at every sign-in. Set
`SMTP_USER` and `SMTP_PASS` (a Gmail app password) in `.env.local`; while they are
empty, the server prints each PIN in its terminal instead (local testing only). If
the server is not running, students cannot finish signing in.

## Hosting the PIN server (free)

The server runs on Render's free plan using `render.yaml`. Free instances sleep after
15 minutes without requests, so the first sign-in after a quiet spell waits up to a
minute; an uptime monitor calling `/healthz` every 10 minutes keeps it awake.

1. On render.com, sign in with GitHub, choose **New > Blueprint** and pick this repository.
2. Fill in the values it asks for: `APP_ORIGIN` (your live site), the three `LIVEKIT_*`
   values, and either `SMTP_USER`/`SMTP_PASS` or `BREVO_API_KEY`/`MAIL_FROM`.
3. Under the service's **Environment > Secret Files**, add `firebase-service-account.json`
   with the contents of your Firebase service-account key.
4. Once it is live, `https://<service>.onrender.com/healthz` returns `{"ok":true}`.
5. Build the website with
   `VITE_LIVEKIT_TOKEN_ENDPOINT=https://<service>.onrender.com/api/livekit/token`.
   The build adds that address to the Content Security Policy automatically.

If PIN emails never arrive and the Render logs show a connection timeout to Gmail, the
host is blocking outgoing SMTP: create a free Brevo account, verify your sender address,
and set `BREVO_API_KEY` and `MAIL_FROM` instead.
