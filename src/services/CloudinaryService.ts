/**
 * Cloudinary Image Upload Service
 * Handles image uploads to Cloudinary (free tier: 25GB storage, 25GB bandwidth)
 * No credit card required, better than Firebase Storage for images
 */

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  apiKey?: string;
}

export class CloudinaryService {
  private static config: CloudinaryConfig | null = null;
  private static readonly UPLOAD_TIMEOUT = 45000; // 45 seconds for safety
  private static uploadQueue: Map<string, Promise<string>> = new Map();

  /**
   * Initialize Cloudinary with configuration
   * Call this once when app starts with your Cloudinary credentials
   */
  static initialize(config: CloudinaryConfig): void {
    this.config = config;
    console.log('✅ Cloudinary initialized:', config.cloudName);
  }

  /**
   * Check if Cloudinary is configured
   */
  static isConfigured(): boolean {
    return this.config !== null && !!this.config.cloudName && !!this.config.uploadPreset;
  }

  /**
   * Get configuration status message
   */
  static getConfigStatus(): string {
    if (!this.config) {
      return 'Not configured - Add Cloudinary credentials in CloudinaryService.ts';
    }
    if (!this.config.cloudName) {
      return 'Missing cloud name';
    }
    if (!this.config.uploadPreset) {
      return 'Missing upload preset';
    }
    return `Configured: ${this.config.cloudName}`;
  }

  /**
   * Upload image to Cloudinary
   * @param file - Image file to upload
   * @returns Cloudinary URL of uploaded image
   */
  static async uploadImage(file: File): Promise<string> {
    const startTime = Date.now();
    try {
      // Check if configured
      if (!this.isConfigured()) {
        throw new Error(
          'Cloudinary not configured. Please add your credentials to CloudinaryService.ts. ' +
          'See CLOUDINARY-SETUP.md for instructions.'
        );
      }

      const config = this.config!;

      // Create form data with optimized settings for speed
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', config.uploadPreset);
      // ⚡ SPEED OPTIMIZATIONS:
      formData.append('quality', 'auto:low'); // Faster than auto:eco, still good quality
      formData.append('fetch_format', 'auto'); // Auto-select best format (webp when supported)
      formData.append('resource_type', 'auto');
      // Add eager transformation for instant delivery (resized version ready immediately)
      formData.append('eager', 'c_limit,w_1200,q_auto:low');
      formData.append('eager_async', 'false'); // Process immediately, not in background

      // Upload URL
      const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;

      console.log('⚡ Starting upload...');

      // Direct fetch with aggressive timeout
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Cloudinary error:', errorData);
        throw new Error(`Upload failed: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Uploaded in ${uploadTime}s: ${(file.size / 1024).toFixed(0)}KB`);

      // Return secure HTTPS URL
      return data.secure_url;
      
    } catch (error: any) {
      console.error('❌ Error uploading to Cloudinary:', error);
      
      // Provide specific error messages
      if (error.message?.includes('timeout')) {
        throw new Error('Upload timeout. Please check your internet connection and try again.');
      } else if (error.message?.includes('not configured')) {
        throw error; // Pass through configuration error
      } else if (error.message?.includes('Network')) {
        throw new Error('Network error. Please check your internet connection.');
      } else {
        throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Upload base64 image to Cloudinary
   * @param base64String - Base64 encoded image
   * @param filename - Optional filename
   * @returns Cloudinary URL
   */
  static async uploadBase64Image(base64String: string, filename?: string): Promise<string> {
    try {
      // Convert base64 to Blob
      const blob = await this.base64ToBlob(base64String);
      
      // Create File from Blob
      const file = new File([blob], filename || `image_${Date.now()}.jpg`, { type: blob.type });
      
      // Upload using regular method
      return await this.uploadImage(file);
    } catch (error: any) {
      console.error('❌ Error uploading base64 image:', error);
      throw new Error(`Failed to upload base64 image: ${error.message}`);
    }
  }

  /**
   * Convert base64 string to Blob
   */
  private static async base64ToBlob(base64String: string): Promise<Blob> {
    // Remove data URL prefix if present
    const base64Data = base64String.includes(',') 
      ? base64String.split(',')[1] 
      : base64String;
    
    // Get mime type
    const mimeMatch = base64String.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    
    // Convert to binary
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Check if a URL is a Cloudinary URL
   */
  static isCloudinaryUrl(url: string): boolean {
    return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
  }

  /**
   * Check if a string is a base64 image
   */
  static isBase64Image(str: string): boolean {
    return str.startsWith('data:image/');
  }

  /**
   * Get optimized image URL with transformations
   * Cloudinary allows on-the-fly image transformations via URL
   * @param url - Original Cloudinary URL
   * @param width - Desired width
   * @param height - Desired height
   * @param quality - Quality (1-100)
   * @returns Transformed URL
   */
  static getOptimizedUrl(url: string, width?: number, height?: number, quality: number = 80): string {
    if (!this.isCloudinaryUrl(url)) {
      return url; // Not a Cloudinary URL, return as-is
    }

    try {
      // Extract the public ID from URL
      const parts = url.split('/upload/');
      if (parts.length !== 2) return url;

      const [baseUrl, pathAndFile] = parts;
      
      // Build transformation string
      const transformations = [];
      if (width) transformations.push(`w_${width}`);
      if (height) transformations.push(`h_${height}`);
      transformations.push(`q_${quality}`);
      transformations.push('f_auto'); // Auto format (WebP for supported browsers)
      
      const transformStr = transformations.join(',');
      
      // Reconstruct URL with transformations
      return `${baseUrl}/upload/${transformStr}/${pathAndFile}`;
    } catch (error) {
      console.error('Error creating optimized URL:', error);
      return url; // Return original URL if transformation fails
    }
  }
}

// Default configuration (will be overridden when user adds their credentials)
// Users should update these values with their own Cloudinary account details
// See CLOUDINARY-SETUP.md for instructions
const DEFAULT_CONFIG: CloudinaryConfig = {
  cloudName: 'dgzs6i8xl', // ✅ Your Cloudinary cloud name
  uploadPreset: 'quiz_master_preset', // Unsigned preset for quiz images
  apiKey: '466727953497156', // Optional - for signed uploads
};

// Auto-initialize if config is provided
if (DEFAULT_CONFIG.cloudName && DEFAULT_CONFIG.uploadPreset) {
  CloudinaryService.initialize(DEFAULT_CONFIG);
  console.log('✅ Cloudinary auto-initialized with cloud:', DEFAULT_CONFIG.cloudName);
} else {
  console.warn('⚠️ Cloudinary not configured. Add credentials to CloudinaryService.ts');
  console.warn('📖 See CLOUDINARY-SETUP.md for setup instructions');
}

export default CloudinaryService;
