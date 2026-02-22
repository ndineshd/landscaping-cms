/**
 * Image Upload Component
 * Handles image selection, compression, and upload
 */

"use client";

import { useState } from "react";
import { Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  validateImageFile,
  compressImage,
  formatFileSize,
  DEFAULT_COMPRESSION_OPTIONS,
  MAX_IMAGE_INPUT_SIZE_MB,
} from "@/lib/image-compression";

interface ImageUploadComponentProps {
  /** Current image URL */
  currentImage?: string;
  /** Password for authentication */
  password: string;
  /** Callback when image is selected and compressed */
  onUpload: (file: File) => void;
  /** Whether component is disabled */
  disabled?: boolean;
}

/**
 * Image Upload Component
 */
export function ImageUploadComponent({
  currentImage,
  password,
  onUpload,
  disabled,
}: Readonly<ImageUploadComponentProps>) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: string;
    compressedSize: string;
    ratio: string;
  } | null>(null);

  /**
   * Handle file selection
   */
  const handleFileSelect = async (file: File) => {
    if (!password) {
      toast.error("Please enter password first");
      return;
    }

    setIsProcessing(true);

    try {
      // Validate image
      validateImageFile(file);

      // Compress image
      const result = await compressImage(file, DEFAULT_COMPRESSION_OPTIONS);

      // Show compression info
      setCompressionInfo({
        originalSize: formatFileSize(result.originalSize),
        compressedSize: formatFileSize(result.compressedSize),
        ratio: `${result.ratio}%`,
      });

      // Call upload callback
      onUpload(result.file);

      toast.success("Image compressed and ready to upload");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to process image";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle drag and drop
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="space-y-3">
      {/* Drag and Drop Area */}
      <div
        onDrop={handleDrop}
        onDragOver={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">
          Drag and drop image here or{" "}
          <label className="text-blue-500 hover:underline cursor-pointer">
            click to select
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              disabled={disabled || isProcessing}
              className="hidden"
            />
          </label>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Max {MAX_IMAGE_INPUT_SIZE_MB}MB - JPG, PNG, WebP
        </p>
      </div>

      {/* Current Image */}
      {currentImage && (
        <div className="relative">
          <img
            src={currentImage}
            alt="Current"
            className="w-full h-40 object-cover rounded-lg"
          />
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
            Current
          </div>
        </div>
      )}

      {/* Compression Info */}
      {compressionInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Compression Complete</p>
              <p className="text-blue-800 text-xs mt-1">
                Original: {compressionInfo.originalSize} to Compressed:{" "}
                {compressionInfo.compressedSize} ({compressionInfo.ratio}{" "}
                reduced)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
