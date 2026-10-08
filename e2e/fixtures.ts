// Test accounts seeded into the emulators by global-setup.ts. Emails use ump.ac.za, the
// default university domain, so the app treats them as student emails.
export const PASSWORD = 'E2e-test-pass-123!';

export interface TestStudent {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  teaches: string[];
  learns: string[];
  accountStatus?: 'active' | 'suspended';
  isAdmin?: boolean;
}

const student = (key: string, firstName: string, lastName: string, teaches: string[], learns: string[], extra: Partial<TestStudent> = {}): TestStudent => ({
  uid: `e2e-${key}`, firstName, lastName, email: `${key}@ump.ac.za`, teaches, learns, ...extra,
});

export const STUDENTS = {
  // Explore → match → chat.
  ayanda: student('ayanda', 'Ayanda', 'Mokoena', ['Python'], ['Guitar']),
  bongani: student('bongani', 'Bongani', 'Dube', ['Guitar'], ['Python']),
  // Session completion and credits. A matched pair with a session that has already started.
  lerato: student('lerato', 'Lerato', 'Nkosi', ['Physics'], ['Statistics']),
  thabo: student('thabo', 'Thabo', 'Khumalo', ['Statistics'], ['Physics']),
  // Account states.
  sipho: student('sipho', 'Sipho', 'Ndlovu', ['Accounting'], ['French'], { accountStatus: 'suspended' }),
  admin: student('admin', 'Ada', 'Admin', ['Mathematics'], ['Spanish'], { isAdmin: true }),
};

export const displayName = (s: TestStudent) => `${s.firstName} ${s.lastName}`;

export const PAST_SESSION_ID = 'e2e-session-started';
export const STARTING_CREDITS = 50;
export const CREDITS_PER_SESSION = 10;
