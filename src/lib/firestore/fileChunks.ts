// Store files inside Firestore as base64 chunk documents.
//
// The project has no Firebase Storage bucket (that needs the paid Blaze plan), so files are
// base64-encoded and split into chunk documents of at most CHUNK_CHARS characters, which
// keeps each one well under Firestore's 1 MiB document limit. Chunks live in a `chunks`
// subcollection of a parent document that describes the file and is written last.
import { doc, getDoc, setDoc, type DocumentReference } from 'firebase/firestore';

// 700k base64 characters per chunk keeps each document well under Firestore's 1 MiB limit.
export const CHUNK_CHARS = 700_000;

/** Number of chunks a file of `bytes` needs once base64-encoded. */
export function chunkCountForBytes(bytes: number): number {
  return Math.ceil((Math.ceil(bytes / 3) * 4) / CHUNK_CHARS);
}

/** Split base64 text into chunk-sized pieces. */
export function splitIntoChunks(text: string, chunkSize = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += chunkSize) {
    chunks.push(text.slice(start, start + chunkSize));
  }
  return chunks;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('The file could not be read. Please choose it again.'));
    reader.readAsDataURL(file);
  });
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => { window.setTimeout(() => reject(new Error(message)), ms); }),
  ]);
}

/**
 * Write each chunk under parentRef/chunks/{index}, one at a time so progress reflects what
 * has actually been saved. onProgress receives 0–1.
 */
export async function writeChunks(parentRef: DocumentReference, chunks: string[], onProgress?: (fraction: number) => void): Promise<void> {
  for (let index = 0; index < chunks.length; index += 1) {
    await withTimeout(
      setDoc(doc(parentRef, 'chunks', String(index)), { index, data: chunks[index] }),
      60_000,
      'The upload timed out. Check your connection and try again.',
    );
    onProgress?.((index + 1) / chunks.length);
  }
}

/** Turn a "data:<type>;base64,..." URL into a Blob without fetch (the CSP blocks fetching data: URLs). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ''] = dataUrl.split(',', 2);
  const contentType = header.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream';
  return base64ToBlob(base64, contentType);
}

export function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

/** Rebuild a file from parentRef/chunks/0..chunkCount-1. */
export async function readChunksAsBlob(parentRef: DocumentReference, chunkCount: number, contentType: string): Promise<Blob> {
  const chunkDocs = await Promise.all(
    Array.from({ length: chunkCount }, (_, index) => getDoc(doc(parentRef, 'chunks', String(index)))),
  );
  if (chunkDocs.some(chunk => !chunk.exists())) throw new Error('This file is incomplete. Ask the sender to upload it again.');
  return base64ToBlob(chunkDocs.map(chunk => chunk.data()?.data || '').join(''), contentType);
}

/** An object URL for the blob that is released after a few minutes. */
export function temporaryObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  return url;
}
