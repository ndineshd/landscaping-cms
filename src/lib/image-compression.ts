/**
 * Image compression and processing utilities
 * Handles image compression before upload to GitHub
 */

import imageCompression from "browser-image-compression";
import type { CompressionOptions, CompressionResult } from "@/types/cms";

/**
 * Default compression options
 */
export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 1400,
  useWebWorker: true,
  initialQuality: 0.82,
  maxIteration: 10,
};

/**
 * Maximum upload size accepted before compression (25MB)
 */
export const MAX_IMAGE_INPUT_SIZE_MB = 25;
const MAX_IMAGE_INPUT_SIZE_BYTES = MAX_IMAGE_INPUT_SIZE_MB * 1024 * 1024;
const BYTES_IN_MB = 1024 * 1024;

/**
 * Allowed image MIME types
 */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Validate image file
 * @param file - File to validate
 * @throws Error if file is invalid
 */
export function validateImageFile(file: File): void {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      `Invalid image type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`
    );
  }

  // Check file size
  if (file.size > MAX_IMAGE_INPUT_SIZE_BYTES) {
    throw new Error(
      `File size exceeds maximum allowed size of ${MAX_IMAGE_INPUT_SIZE_MB}MB. Current size: ${(file.size / BYTES_IN_MB).toFixed(2)}MB`
    );
  }
}

function resolveCompressionOptions(options: CompressionOptions): CompressionOptions {
  return {
    ...DEFAULT_COMPRESSION_OPTIONS,
    ...options,
  };
}

function getFallbackCompressionOptions(
  baseOptions: CompressionOptions
): CompressionOptions[] {
  return [
    {
      ...baseOptions,
      maxSizeMB: Math.max(baseOptions.maxSizeMB * 0.75, 0.2),
      maxWidthOrHeight: Math.max(Math.floor(baseOptions.maxWidthOrHeight * 0.85), 960),
      initialQuality: Math.min(baseOptions.initialQuality ?? 0.82, 0.72),
      maxIteration: Math.max(baseOptions.maxIteration ?? 10, 10),
    },
    {
      ...baseOptions,
      maxSizeMB: Math.max(baseOptions.maxSizeMB * 0.5, 0.12),
      maxWidthOrHeight: Math.max(Math.floor(baseOptions.maxWidthOrHeight * 0.7), 800),
      initialQuality: Math.min(baseOptions.initialQuality ?? 0.82, 0.6),
      maxIteration: Math.max(baseOptions.maxIteration ?? 10, 12),
    },
  ];
}

/**
 * Compress image file
 * @param file - Image file to compress
 * @param options - Compression options
 * @returns Compression result with original and compressed sizes
 * @throws Error if compression fails
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = DEFAULT_COMPRESSION_OPTIONS
): Promise<CompressionResult> {
  try {
    // Validate file before compression
    validateImageFile(file);

    const compressionOptions = resolveCompressionOptions(options);
    const originalSize = file.size;
    const targetSizeBytes = compressionOptions.maxSizeMB * BYTES_IN_MB;

    // Compress image
    let compressedFile = await imageCompression(file, compressionOptions);

    // If still above target, retry with more aggressive settings.
    if (compressedFile.size > targetSizeBytes) {
      const fallbackOptions = getFallbackCompressionOptions(compressionOptions);
      for (const fallback of fallbackOptions) {
        const candidate = await imageCompression(file, fallback);
        if (candidate.size < compressedFile.size) {
          compressedFile = candidate;
        }
        if (compressedFile.size <= targetSizeBytes) {
          break;
        }
      }
    }

    if (compressedFile.size > originalSize) {
      compressedFile = file;
    }

    // Calculate compression ratio
    const compressedSize = compressedFile.size;
    const ratio = Math.max(
      0,
      ((originalSize - compressedSize) / originalSize) * 100
    ).toFixed(2);

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      ratio: parseFloat(ratio),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Image compression failed: ${error.message}`);
    }
    throw new Error("Image compression failed");
  }
}

/**
 * Convert file to base64 string
 * @param file - File to convert
 * @returns Base64 encoded string
 * @throws Error if conversion fails
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) {
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };

    reader.onerror = () => {
      reject(new Error("FileReader error"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Generate unique filename for image
 * @param originalFileName - Original file name
 * @returns Unique filename with timestamp
 */
export function generateUniqueFileName(originalFileName: string): string {
  const timestamp = Date.now();
  const extension = originalFileName.split(".").pop() || "jpg";
  return `img-${timestamp}.${extension}`;
}

function toSafeImageExtension(originalFileName: string): string {
  const rawExtension = originalFileName.split(".").pop()?.toLowerCase() || "jpg";
  if (
    ["jpg", "jpeg", "png", "webp", "mp4", "webm", "ogg", "mov"].includes(
      rawExtension
    )
  ) {
    return rawExtension;
  }
  return "jpg";
}

export function generateDeterministicImageFileName(
  contentHash: string,
  originalFileName: string
): string {
  const normalizedHash = contentHash.trim().toLowerCase().replace(/[^a-f0-9]/g, "");
  const safeHash = normalizedHash.slice(0, 32) || String(Date.now());
  const extension = toSafeImageExtension(originalFileName);
  return `img-${safeHash}.${extension}`;
}

export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Format file size for display
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get image dimensions
 * @param file - Image file
 * @returns Width and height of image
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
        });
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("FileReader error"));
    };

    reader.readAsDataURL(file);
  });
}
