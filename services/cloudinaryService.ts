
const CLOUD_NAME = 'doqmnlkuw';
const UPLOAD_PRESET = 'Commune Chat'; // Space is handled by FormData

export const compressImage = (file: File, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Use jpeg for better compression, quality 0.7
        resolve(canvas.toDataURL('image/jpeg', 0.7)); 
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const uploadToCloudinary = async (file: File, isProfilePic = false): Promise<{ url: string; type: 'image' | 'video' } | null> => {
  try {
    let fileToUpload: File | Blob = file;
    let isVideo = file.type.startsWith('video/');
    let base64Fallback = '';

    if (!isVideo) {
       // Compress image before upload
       base64Fallback = await compressImage(file, isProfilePic ? 400 : 1200, isProfilePic ? 400 : 1200);
       // Convert base64 back to blob for Cloudinary
       const res = await fetch(base64Fallback);
       fileToUpload = await res.blob();
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.warn('Cloudinary upload failed, falling back to base64 if image');
      if (!isVideo && base64Fallback) {
         // Check if base64 is under ~900KB (Firestore limit is 1MB)
         if (base64Fallback.length < 900000) {
            return { url: base64Fallback, type: 'image' };
         }
      }
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return {
      url: data.secure_url,
      type: data.resource_type === 'video' ? 'video' : 'image'
    };
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    return null;
  }
};
