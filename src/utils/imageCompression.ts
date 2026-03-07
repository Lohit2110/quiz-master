/**
 * Image Compression Utility
 * Compresses images while maintaining good visual quality
 * Optimized for 50 images per quiz (target: ~20KB per image)
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  maxSizeKB?: number;
}

/**
 * Compress an image from a file or data URL
 * Returns a compressed data URL
 */
export async function compressImage(
  imageSource: File | string,
  options: CompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 800,       // Balanced resolution for 50 images
    maxHeight = 800,      // Maintains good readability
    quality = 0.75,       // Good quality (75% - clear and readable)
    maxSizeKB = 25        // Target size for 50 images per quiz
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Try different quality levels if image is still too large
        let currentQuality = quality;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        
        // Check size and reduce quality if needed
        const sizeKB = (compressedDataUrl.length * 0.75) / 1024; // Approximate size
        
        if (sizeKB > maxSizeKB && currentQuality > 0.55) {
          // Gradually reduce quality to hit target size
          while (currentQuality > 0.55) {
            currentQuality -= 0.05;
            compressedDataUrl = canvas.toDataURL('image/jpeg', currentQuality);
            const newSizeKB = (compressedDataUrl.length * 0.75) / 1024;
            
            if (newSizeKB <= maxSizeKB) {
              break;
            }
          }
        }
        
        console.log(`📸 Image optimized (HIGH QUALITY): ${img.width}x${img.height} → ${width}x${height}, Quality: ${Math.round(currentQuality * 100)}%, Size: ~${Math.round((compressedDataUrl.length * 0.75) / 1024)}KB`);
        
        resolve(compressedDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    // Load image from File or data URL
    if (imageSource instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(imageSource);
    } else {
      img.src = imageSource;
    }
  });
}

/**
 * Compress all images in a quiz
 * Returns the quiz with compressed images
 */
export async function compressQuizImages(quiz: any): Promise<any> {
  console.log(`🔄 Optimizing images in quiz (optimized for 50 images): ${quiz.title}`);
  
  const compressedQuiz = { ...quiz };
  let imageCount = 0;
  let compressedCount = 0;
  
  // Process each question
  if (compressedQuiz.questions && Array.isArray(compressedQuiz.questions)) {
    for (let i = 0; i < compressedQuiz.questions.length; i++) {
      const question = compressedQuiz.questions[i];
      
      // Check if question has an image
      if (question.image && question.image.startsWith('data:image/')) {
        imageCount++;
        
        try {
          // Compress with balanced settings - 75% quality, 800px max
          // Target: ~20KB per image for 50 images
          const compressed = await compressImage(question.image, {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.75,
            maxSizeKB: 25
          });
          
          question.image = compressed;
          compressedCount++;
        } catch (error) {
          console.warn(`⚠️ Failed to compress image in question ${i + 1}:`, error);
          // Keep original image if compression fails
        }
      }
      
      // Check options for images (if your quiz supports image options)
      if (question.options && Array.isArray(question.options)) {
        for (const option of question.options) {
          if (option.image && option.image.startsWith('data:image/')) {
            imageCount++;
            
            try {
              const compressed = await compressImage(option.image, {
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.75,
                maxSizeKB: 25
              });
              
              option.image = compressed;
              compressedCount++;
            } catch (error) {
              console.warn(`⚠️ Failed to compress option image:`, error);
            }
          }
        }
      }
    }
  }
  
  console.log(`✅ Optimized ${compressedCount}/${imageCount} images in quiz with PREMIUM quality (92%)`);
  
  return compressedQuiz;
}

/**
 * Calculate the approximate size of a quiz in bytes
 */
export function calculateQuizSize(quiz: any): number {
  const jsonString = JSON.stringify(quiz);
  return new Blob([jsonString]).size;
}

/**
 * Calculate the approximate size in KB
 */
export function calculateQuizSizeKB(quiz: any): number {
  return calculateQuizSize(quiz) / 1024;
}

/**
 * Calculate the approximate size in MB
 */
export function calculateQuizSizeMB(quiz: any): number {
  return calculateQuizSizeKB(quiz) / 1024;
}

/**
 * Check if quiz is within Firebase size limits
 * Firebase document limit is 1MB (1,048,576 bytes)
 */
export function isQuizWithinSizeLimit(quiz: any): boolean {
  const sizeBytes = calculateQuizSize(quiz);
  const limitBytes = 1048576; // 1 MB
  return sizeBytes < limitBytes;
}

/**
 * Get human-readable size
 */
export function getHumanReadableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Compress quiz if it exceeds size limit
 */
export async function ensureQuizWithinLimit(quiz: any): Promise<{
  quiz: any;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
  withinLimit: boolean;
}> {
  const originalSize = calculateQuizSize(quiz);
  const originalWithinLimit = isQuizWithinSizeLimit(quiz);
  
  console.log(`📊 Original quiz size: ${getHumanReadableSize(originalSize)}`);
  
  if (originalWithinLimit) {
    console.log('✅ Quiz is already within size limit');
    return {
      quiz,
      compressed: false,
      originalSize,
      finalSize: originalSize,
      withinLimit: true
    };
  }
  
  console.log('⚠️ Quiz exceeds size limit, compressing images...');
  
  // Compress images
  const compressedQuiz = await compressQuizImages(quiz);
  const finalSize = calculateQuizSize(compressedQuiz);
  const finalWithinLimit = isQuizWithinSizeLimit(compressedQuiz);
  
  console.log(`📊 Final quiz size: ${getHumanReadableSize(finalSize)}`);
  console.log(`📉 Size reduction: ${getHumanReadableSize(originalSize - finalSize)} (${Math.round(((originalSize - finalSize) / originalSize) * 100)}%)`);
  
  if (finalWithinLimit) {
    console.log('✅ Quiz is now within size limit');
  } else {
    console.warn('⚠️ Quiz still exceeds size limit after compression');
  }
  
  return {
    quiz: compressedQuiz,
    compressed: true,
    originalSize,
    finalSize,
    withinLimit: finalWithinLimit
  };
}
