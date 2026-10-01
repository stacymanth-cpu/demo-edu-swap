import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: {}, db: {}, storage: {} }));
vi.mock('./users', () => ({ updateUser: vi.fn() }));

const { CHUNK_CHARS, chunkCountForBytes, dataUrlToBlob } = await import('./fileChunks');
const { CHAT_FILE_MAX_BYTES, CHAT_FILE_MAX_CHUNKS, getChatFileContentType, isChatFileReference } = await import('./chat');

describe('chat files stored in Firestore', () => {
  it('fits the largest allowed chat file within the chunk limit the rules enforce', () => {
    expect(chunkCountForBytes(CHAT_FILE_MAX_BYTES)).toBeLessThanOrEqual(CHAT_FILE_MAX_CHUNKS);
  });

  it('keeps chunks below Firestore’s 1 MiB document limit', () => {
    expect(CHUNK_CHARS).toBeLessThan(1024 * 1024 - 1024);
  });

  it('accepts every type the chat picker offers, judged by extension', () => {
    for (const name of ['a.pdf', 'b.doc', 'c.DOCX', 'd.txt', 'e.ppt', 'f.pptx', 'g.xls', 'h.xlsx', 'i.jpg', 'j.png']) {
      expect(getChatFileContentType(name)).not.toBeNull();
    }
    expect(getChatFileContentType('virus.exe')).toBeNull();
    expect(getChatFileContentType('no-extension')).toBeNull();
  });

  it('rebuilds older embedded data: files as blobs with their type', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,aGVsbG8=');
    expect(blob.type).toBe('image/png');
    expect(await blob.text()).toBe('hello');
  });

  it('tells Firestore file references apart from Storage links', () => {
    expect(isChatFileReference('eduswap-file:abc123')).toBe(true);
    expect(isChatFileReference('data:image/jpeg;base64,abc')).toBe(true);
    expect(isChatFileReference('https://firebasestorage.googleapis.com/v0/b/x/o/y')).toBe(false);
    expect(isChatFileReference(undefined)).toBe(false);
  });
});
