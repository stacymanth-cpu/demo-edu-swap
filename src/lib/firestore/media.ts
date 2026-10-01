// Profile photo uploads. Introduction videos are recorded in the app; see ./introVideos.
import { updateUser } from './users';

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
