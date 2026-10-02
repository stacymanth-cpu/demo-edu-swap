import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: {}, db: {} }));
vi.mock('./users', () => ({ updateUser: vi.fn() }));

const { emailDomain, isUniversityEmail, normalizeDomains } = await import('./emailVerification');

describe('university email verification helpers', () => {
  it('extracts the lower-case domain of an address', () => {
    expect(emailDomain('240283171@UMP.ac.za')).toBe('ump.ac.za');
    expect(emailDomain('not-an-email')).toBe('');
    expect(emailDomain(undefined)).toBe('');
  });

  it('recognises approved university domains only', () => {
    expect(isUniversityEmail('student@ump.ac.za', ['ump.ac.za'])).toBe(true);
    expect(isUniversityEmail('student@gmail.com', ['ump.ac.za'])).toBe(false);
    expect(isUniversityEmail('student@fake-ump.ac.za', ['ump.ac.za'])).toBe(false);
  });

  it('cleans the admin list of domains', () => {
    expect(normalizeDomains([' @UMP.ac.za ', 'wits.ac.za', 'wits.ac.za', '', 'not a domain', 42])).toEqual(['ump.ac.za', 'wits.ac.za']);
    expect(normalizeDomains('ump.ac.za')).toEqual([]);
  });
});
