// Profile photo and introduction video uploads.
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { updateUser } from './users';
import { toStorageUploadError } from './shared';

/**
 * Resize and convert image to base64 data URL, then store in Firestore.
 * Max 200x200px, JPEG quality 0.7 to keep the string small.
 */
export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Profile photos must be JPG, PNG, or WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile photos must be 5 MB or smaller.');
  const dataUrl = await resizeImage(file, 200, 200, 0.7);
  await updateUser(uid, { photoUrl: dataUrl });
  return dataUrl;
}

export async function uploadIntroductionVideo(uid: string, file: File, onProgress?: (progress: number) => void): Promise<string> {
  if (!file.type.startsWith('video/')) throw new Error('Please select a video file.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Introduction videos must be 50 MB or smaller.');
  const storageRef = ref(storage, `introductionVideos/${uid}/${Date.now()}-${file.name}`);
  const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });
  const videoUrl = await new Promise<string>((resolve, reject) => {
    uploadTask.on('state_changed', snapshot => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)), error => reject(toStorageUploadError(error)), async () => {
      try { resolve(await getDownloadURL(uploadTask.snapshot.ref)); } catch (error) { reject(error); }
    });
  });
  await updateUser(uid, { introductionVideoUrl: videoUrl });
  return videoUrl;
}

function resizeImage(file: File, maxW: number, maxH: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
