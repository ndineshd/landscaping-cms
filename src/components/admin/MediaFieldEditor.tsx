"use client";

import { AlertCircle, CheckCircle2, RefreshCw, Upload, X } from "lucide-react";

import { stringifyValue } from "@/lib/cms-utils";
import type { MediaUploadFieldState } from "@/types/cms";
import { createUploadInputId, isVideoPath, toLabel } from "@/components/admin/itemEditorUtils";

interface MediaFieldEditorProps {
  allowProjectGalleryVideo: boolean;
  disabled?: boolean;
  fieldName: string;
  fieldPath: (string | number)[];
  getMediaUploadState?: (fieldPath: (string | number)[]) => MediaUploadFieldState | null;
  onFieldChange: (fieldPath: (string | number)[], value: unknown) => void;
  onImageRemove: (fieldPath: (string | number)[], currentValue?: string) => void;
  onImageUpload: (fieldPath: (string | number)[], file: File, currentValue?: string) => void;
  uploadScopeId: string;
  value: unknown;
}

export function MediaFieldEditor({
  allowProjectGalleryVideo,
  disabled,
  fieldName,
  fieldPath,
  getMediaUploadState,
  onFieldChange,
  onImageRemove,
  onImageUpload,
  uploadScopeId,
  value,
}: Readonly<MediaFieldEditorProps>): JSX.Element {
  const currentValue = stringifyValue(value).trim();
  const hasMedia = currentValue.length > 0;
  const isVideoMedia = isVideoPath(currentValue);
  const rootPathSegment = fieldPath[0];
  const supportsVideoUpload =
    allowProjectGalleryVideo &&
    typeof rootPathSegment === "string" &&
    rootPathSegment === "images";
  const uploadInputId = createUploadInputId(fieldPath, uploadScopeId);
  const canPreview =
    currentValue.startsWith("/") ||
    currentValue.startsWith("http://") ||
    currentValue.startsWith("https://");
  const acceptedFileTypes = supportsVideoUpload
    ? "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/ogg,video/quicktime"
    : "image/jpeg,image/png,image/webp";
  const mediaUploadState = getMediaUploadState?.(fieldPath) || null;
  const uploadProgress = Math.round(
    Math.max(0, Math.min(100, mediaUploadState?.progress ?? 0))
  );
  const isUploading = mediaUploadState?.status === "processing";
  const uploadStatusLabel =
    mediaUploadState?.status === "queued"
      ? "Queued"
      : mediaUploadState?.status === "error"
        ? "Failed"
        : mediaUploadState?.status === "processing"
          ? "Uploading"
          : "";
  const uploadStatusColor =
    mediaUploadState?.status === "queued"
      ? "#16a34a"
      : mediaUploadState?.status === "error"
        ? "#dc2626"
        : "#2563eb";
  const uploadStatusClassName =
    mediaUploadState?.status === "queued"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : mediaUploadState?.status === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <div className="space-y-3">
      {hasMedia ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
          {canPreview ? (
            isVideoMedia ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                className="h-32 w-full rounded object-cover bg-black"
                controls
                src={currentValue}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentValue}
                alt={toLabel(fieldName)}
                className="h-32 w-full rounded object-cover"
              />
            )
          ) : (
            <p className="break-all text-xs text-slate-600">{currentValue}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No media selected.</p>
      )}

      <input
        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        disabled={disabled}
        onChange={(event) => onFieldChange(fieldPath, event.target.value)}
        placeholder="/uploads/path/file.jpg"
        type="text"
        value={stringifyValue(value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-3 py-2 text-xs font-medium text-white ${
            disabled || isUploading ? "bg-slate-300" : "bg-blue-600 hover:bg-blue-700"
          }`}
          htmlFor={uploadInputId}
        >
          {hasMedia ? (
            <RefreshCw className={`h-3.5 w-3.5 ${isUploading ? "animate-spin" : ""}`} />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {isUploading ? "Uploading..." : hasMedia ? "Re-upload" : "Upload"}
        </label>
        <input
          accept={acceptedFileTypes}
          className="hidden"
          disabled={disabled || isUploading}
          id={uploadInputId}
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];

            if (selectedFile) {
              onImageUpload(fieldPath, selectedFile, currentValue || undefined);
            }

            event.target.value = "";
          }}
          type="file"
        />

        {hasMedia && (
          <button
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
            disabled={disabled || isUploading}
            onClick={() => onImageRemove(fieldPath, currentValue)}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>
      {mediaUploadState && (
        <div
          className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${uploadStatusClassName}`}
        >
          <div
            aria-hidden
            className="relative h-8 w-8 rounded-full"
            style={{
              background: `conic-gradient(${uploadStatusColor} ${uploadProgress * 3.6}deg, #cbd5e1 0deg)`,
            }}
          >
            <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-700">
              {uploadProgress}%
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-medium">
              {mediaUploadState.status === "queued" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : mediaUploadState.status === "error" ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              )}
              <span>{uploadStatusLabel}</span>
            </div>
            {mediaUploadState.message && <p className="truncate">{mediaUploadState.message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
