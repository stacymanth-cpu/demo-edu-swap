import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ default: {}, db: {} }));
vi.mock('./users', () => ({ updateUser: vi.fn() }));

const { REGISTRATION_CHUNK_CHARS, REGISTRATION_MAX_BYTES, REGISTRATION_MAX_CHUNKS, splitIntoChunks } = await import('./registration');

describe('registration document chunking', () => {
  it('splits text into ordered chunks that rejoin exactly', () => {
    const text = 'abcdefghij';
    const chunks = splitIntoChunks(text, 3);
    expect(chunks).toEqual(['abc', 'def', 'ghi', 'j']);
    expect(chunks.join('')).toBe(text);
  });

  it('fits the largest allowed file within the chunk limit the rules enforce', () => {
    const base64Length = Math.ceil(REGISTRATION_MAX_BYTES / 3) * 4;
    expect(Math.ceil(base64Length / REGISTRATION_CHUNK_CHARS)).toBeLessThanOrEqual(REGISTRATION_MAX_CHUNKS);
  });

  it('keeps every chunk below Firestore’s 1 MiB document limit', () => {
    expect(REGISTRATION_CHUNK_CHARS).toBeLessThan(1024 * 1024 - 1024);
  });
});
