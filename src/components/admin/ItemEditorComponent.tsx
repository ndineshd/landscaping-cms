/**
 * Item Editor Component
 * Displays and edits item fields (supports nested objects and arrays)
 */

"use client";

import { useId, useState } from "react";
import { Plus, Trash2, Upload, RefreshCw, X } from "lucide-react";
import type { DataItem, DynamicField } from "@/types/cms";
import { stringifyValue } from "@/lib/cms-utils";
import {
  buildLocalizedFieldKey,
  isLanguageVariantKey,
  isTranslatableTextField,
} from "@/lib/language-utils";

interface ItemEditorComponentProps {
  /** Item to edit */
  item: DataItem;
  /** Available fields */
  fields: DynamicField[];
  /** Admin password (kept for API compatibility) */
  password: string;
  /** Callback when field changes */
  onFieldChange: (fieldPath: (string | number)[], value: unknown) => void;
  /** Callback to upload image at given field path */
  onImageUpload: (
    fieldPath: (string | number)[],
    file: File,
    currentValue?: string
  ) => void;
  /** Callback to remove image at given field path */
  onImageRemove: (fieldPath: (string | number)[], currentValue?: string) => void;
  /** Callback to delete item */
  onDelete: () => void;
  /** If true, id is auto-generated from content fields */
  autoIdFromContent?: boolean;
  /** Whether component is disabled */
  disabled?: boolean;
  /** Allow video upload support for project gallery (`images`) */
  allowProjectGalleryVideo?: boolean;
  /** Active language code used in editor */
  activeLanguageCode?: string;
  /** Default language code configured for site */
  defaultLanguageCode?: string;
  /** Configured language codes */
  availableLanguageCodes?: string[];
  /** Enable language-aware editing for this file */
  enableLanguageEditing?: boolean;
  /** Exact dot-paths to hide from rendering */
  hiddenFieldPaths?: string[];
  /** Limit rendered top-level fields to this list */
  filterFieldNames?: string[];
  /** Limit language-aware editing to these top-level roots */
  languageEditableRootPaths?: string[];
  /** Limit language-aware editing to specific dot-path prefixes */
  languageEditablePathPrefixes?: string[];
  /** Custom heading used for collapsed and expanded title */
  titleOverride?: string;
  /** Hide delete action (used for singleton config editors) */
  hideDeleteAction?: boolean;
  /** Initial expand state */
  defaultExpanded?: boolean;
}

function toLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createDefaultFromSample(sample: unknown): unknown {
  if (Array.isArray(sample)) return [];
  if (isRecord(sample)) {
    return Object.fromEntries(
      Object.entries(sample).map(([key, value]) => [key, createDefaultFromSample(value)])
    );
  }
  if (typeof sample === "number") return 0;
  if (typeof sample === "boolean") return false;
  return "";
}

function shouldUseTextarea(fieldName: string, value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value.length > 100 ||
      fieldName.toLowerCase().includes("description") ||
      fieldName.toLowerCase().includes("message"))
  );
}

interface SelectOption {
  label: string;
  value: string;
}

const FIELD_SELECT_OPTIONS: Record<string, SelectOption[]> = {
  "site.logo.displayMode": [
    { value: "generated-with-name", label: "Generated + Company Name" },
    { value: "image-with-name", label: "Image + Company Name" },
    { value: "image-only", label: "Image Only" },
  ],
  "site.logo.type": [
    { value: "text", label: "Generated" },
    { value: "image", label: "Image" },
  ],
  "site.logo.imageObjectFit": [
    { value: "contain", label: "Contain" },
    { value: "cover", label: "Cover" },
  ],
  "site.logo.imageBlendMode": [
    { value: "normal", label: "Normal" },
    { value: "multiply", label: "Multiply" },
    { value: "screen", label: "Screen" },
    { value: "overlay", label: "Overlay" },
    { value: "darken", label: "Darken" },
    { value: "lighten", label: "Lighten" },
    { value: "color", label: "Color" },
    { value: "luminosity", label: "Luminosity" },
  ],
};

const IMAGE_FIELD_KEYWORDS = [
  "image",
  "photo",
  "thumbnail",
  "banner",
  "logo",
  "favicon",
  "ogimage",
];
const IMAGE_PARENT_KEYWORDS = ["images", "gallery", "photos", "banners"];
const IMAGE_METADATA_KEYWORDS = ["width", "height", "blend", "objectfit", "fit", "ratio"];

function isImagePath(value: string): boolean {
  const trimmedValue = value.trim();
  if (!trimmedValue) return false;

  if (
    /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(trimmedValue) ||
    /^\/.+\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(trimmedValue)
  ) {
    return true;
  }

  return trimmedValue.startsWith("/uploads/");
}

function isVideoPath(value: string): boolean {
  const trimmedValue = value.trim().toLowerCase();
  if (!trimmedValue) return false;

  return (
    /^https?:\/\/.+\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmedValue) ||
    /^\/.+\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmedValue)
  );
}

function pathLooksLikeImage(fieldPath: (string | number)[]): boolean {
  const stringSegments = fieldPath.filter(
    (segment): segment is string => typeof segment === "string"
  );
  if (stringSegments.length === 0) return false;

  const leafSegment = stringSegments[stringSegments.length - 1]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const parentSegment = stringSegments.length > 1
    ? stringSegments[stringSegments.length - 2]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
    : "";

  if (
    IMAGE_FIELD_KEYWORDS.some((keyword) => leafSegment.includes(keyword))
  ) {
    return true;
  }

  return IMAGE_PARENT_KEYWORDS.some((keyword) =>
    parentSegment.includes(keyword)
  );
}

function isImageMetadataField(fieldPath: (string | number)[]): boolean {
  const stringSegments = fieldPath.filter(
    (segment): segment is string => typeof segment === "string"
  );
  if (stringSegments.length === 0) return false;

  const leafSegment = stringSegments[stringSegments.length - 1]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return IMAGE_METADATA_KEYWORDS.some((keyword) => leafSegment.includes(keyword));
}

function isImageLikeField(
  fieldName: string,
  value: unknown,
  fieldPath: (string | number)[]
): boolean {
  if (isImageMetadataField(fieldPath)) {
    return false;
  }

  if (typeof value === "string" && isImagePath(value)) {
    return true;
  }

  const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (
    IMAGE_FIELD_KEYWORDS.some((keyword) =>
      normalizedFieldName.includes(keyword)
    )
  ) {
    return true;
  }

  return pathLooksLikeImage(fieldPath);
}

function createUploadInputId(fieldPath: (string | number)[], scopeId: string): string {
  return `upload-${scopeId}-${fieldPath
    .map((segment) => String(segment))
    .join("-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .toLowerCase()}`;
}

function getFieldSelectOptions(fieldPath: (string | number)[]): SelectOption[] | null {
  const pathKey = fieldPath
    .filter((segment): segment is string => typeof segment === "string")
    .join(".");
  return FIELD_SELECT_OPTIONS[pathKey] || null;
}

/**
 * Item Editor Component
 */
export function ItemEditorComponent({
  item,
  fields,
  onFieldChange,
  onImageUpload,
  onImageRemove,
  onDelete,
  autoIdFromContent,
  disabled,
  allowProjectGalleryVideo = false,
  activeLanguageCode = "en",
  defaultLanguageCode = "en",
  availableLanguageCodes = ["en"],
  enableLanguageEditing = false,
  hiddenFieldPaths = [],
  filterFieldNames,
  languageEditableRootPaths,
  languageEditablePathPrefixes,
  titleOverride,
  hideDeleteAction = false,
  defaultExpanded = false,
}: Readonly<ItemEditorComponentProps>) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const uploadScopeId = useId().replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
  const languageCodes = Array.from(new Set(availableLanguageCodes));
  const isSecondaryLanguageSelected =
    enableLanguageEditing && activeLanguageCode !== defaultLanguageCode;
  const hiddenKeys = new Set<string>(["__localId"]);
  const hiddenPathSet = new Set(hiddenFieldPaths);
  const filteredFieldSet = filterFieldNames ? new Set(filterFieldNames) : null;
  const languageEditableRootSet = languageEditableRootPaths
    ? new Set(languageEditableRootPaths)
    : null;
  const languageEditablePathPrefixesList = (languageEditablePathPrefixes || [])
    .map((path) => path.trim())
    .filter(Boolean);
  if (autoIdFromContent) hiddenKeys.add("id");

  const isHiddenPath = (fieldPath: (string | number)[]) =>
    hiddenPathSet.has(fieldPath.map((segment) => String(segment)).join("."));
  const buildPathKey = (fieldPath: (string | number)[]) =>
    fieldPath
      .filter((segment): segment is string => typeof segment === "string")
      .join(".");
  const isLanguageEditablePath = (fieldPath: (string | number)[]) => {
    const pathKey = buildPathKey(fieldPath);
    if (languageEditablePathPrefixesList.length > 0) {
      return languageEditablePathPrefixesList.some(
        (prefix) => pathKey === prefix || pathKey.startsWith(`${prefix}.`)
      );
    }

    if (!languageEditableRootSet || languageEditableRootSet.size === 0) {
      return true;
    }
    const rootSegment = fieldPath[0];
    return typeof rootSegment === "string" && languageEditableRootSet.has(rootSegment);
  };

  const getLocalizedPreviewValue = (
    fieldName: string,
    value: unknown,
    fieldPath: (string | number)[]
  ): unknown => {
    if (!isSecondaryLanguageSelected) {
      return value;
    }

    if (!isLanguageEditablePath(fieldPath)) {
      return value;
    }

    if (!isTranslatableTextField(fieldName, value, languageCodes)) {
      return value;
    }

    const localizedKey = buildLocalizedFieldKey(fieldName, activeLanguageCode);
    const localizedValue = item[localizedKey];
    return typeof localizedValue === "string" ? localizedValue : value;
  };

  const localizedTitleKey = buildLocalizedFieldKey("title", activeLanguageCode);
  const localizedNameKey = buildLocalizedFieldKey("name", activeLanguageCode);
  const displayTitle =
    (isSecondaryLanguageSelected
      ? stringifyValue(item[localizedTitleKey] ?? item.title) ||
        stringifyValue(item[localizedNameKey] ?? item.name)
      : stringifyValue(item.title) || stringifyValue(item.name));
  const hasSavedIdentity =
    typeof item.id === "number" ||
    (typeof item.id === "string" && item.id.trim().length > 0);

  const previewEntries = Object.entries(item)
    .filter(([key, value]) => {
      if (filteredFieldSet && !filteredFieldSet.has(key)) return false;
      if (hiddenKeys.has(key)) return false;
      if (enableLanguageEditing && isLanguageVariantKey(key, languageCodes)) {
        return false;
      }
      return !isRecord(value) && !Array.isArray(value);
    })
    .map(([key, value]) => [key, getLocalizedPreviewValue(key, value, [key])] as const)
    .slice(0, 2);

  const handleArrayAdd = (
    fieldPath: (string | number)[],
    fieldName: string,
    currentArray: unknown[]
  ) => {
    const firstValue = currentArray[0];
    let newValue: unknown;

    if (firstValue !== undefined) {
      newValue = createDefaultFromSample(firstValue);
    } else if (fieldName.toLowerCase().includes("feature")) {
      newValue = { title: "" };
    } else {
      newValue = "";
    }

    onFieldChange(fieldPath, [...currentArray, newValue]);
  };

  const handleArrayRemove = (
    fieldPath: (string | number)[],
    currentArray: unknown[],
    removeIndex: number
  ) => {
    onFieldChange(
      fieldPath,
      currentArray.filter((_, index) => index !== removeIndex)
    );
  };

  const renderScalarField = (
    fieldName: string,
    value: unknown,
    fieldPath: (string | number)[]
  ) => {
    if (isImageLikeField(fieldName, value, fieldPath)) {
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
        currentValue.startsWith("/") || currentValue.startsWith("http://") || currentValue.startsWith("https://");
      const acceptedFileTypes = supportsVideoUpload
        ? "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/ogg,video/quicktime"
        : "image/jpeg,image/png,image/webp";

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
                <p className="text-xs text-slate-600 break-all">{currentValue}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No media selected.</p>
          )}

          <input
            type="text"
            value={stringifyValue(value)}
            onChange={(e) => onFieldChange(fieldPath, e.target.value)}
            disabled={disabled}
            placeholder="/uploads/path/file.jpg"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={uploadInputId}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-3 py-2 text-xs font-medium text-white ${
                disabled ? "bg-slate-300" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {hasMedia ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {hasMedia ? "Re-upload" : "Upload"}
            </label>
            <input
              id={uploadInputId}
              type="file"
              accept={acceptedFileTypes}
              disabled={disabled}
              className="hidden"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) {
                  onImageUpload(fieldPath, selectedFile, currentValue || undefined);
                }
                e.target.value = "";
              }}
            />

            {hasMedia && (
              <button
                type="button"
                onClick={() => onImageRemove(fieldPath, currentValue)}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
      );
    }

    if (typeof value === "boolean") {
      return (
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onFieldChange(fieldPath, e.target.checked)}
          disabled={disabled}
          className="h-4 w-4"
        />
      );
    }

    if (typeof value === "number") {
      return (
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onFieldChange(fieldPath, Number(e.target.value))}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      );
    }

    if (typeof value === "string") {
      const selectOptions = getFieldSelectOptions(fieldPath);
      if (selectOptions) {
        const hasCurrentValue = selectOptions.some((option) => option.value === value);
        const options = hasCurrentValue
          ? selectOptions
          : [{ value, label: value || "Current Value" }, ...selectOptions];

        return (
          <select
            value={value}
            onChange={(e) => onFieldChange(fieldPath, e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }
    }

    if (shouldUseTextarea(fieldName, value)) {
      return (
        <textarea
          value={stringifyValue(value)}
          onChange={(e) => onFieldChange(fieldPath, e.target.value)}
          disabled={disabled}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-y"
        />
      );
    }

    return (
      <input
        type="text"
        value={stringifyValue(value)}
        onChange={(e) => onFieldChange(fieldPath, e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
    );
  };

  const renderField = (
    fieldName: string,
    value: unknown,
    fieldPath: (string | number)[],
    depth = 0,
    parentRecord?: Record<string, unknown>
  ): JSX.Element | null => {
    if (hiddenKeys.has(fieldName)) return null;
    if (isHiddenPath(fieldPath)) return null;
    if (enableLanguageEditing && isLanguageVariantKey(fieldName, languageCodes)) return null;

    let resolvedValue = value;
    let resolvedFieldPath = fieldPath;

    if (
      isSecondaryLanguageSelected &&
      parentRecord &&
      isLanguageEditablePath(fieldPath) &&
      isTranslatableTextField(fieldName, value, languageCodes)
    ) {
      const localizedKey = buildLocalizedFieldKey(fieldName, activeLanguageCode);
      resolvedFieldPath = [...fieldPath.slice(0, -1), localizedKey];
      const localizedValue = parentRecord[localizedKey];
      if (typeof localizedValue === "string") {
        resolvedValue = localizedValue;
      }
    }

    if (Array.isArray(resolvedValue)) {
      return (
        <div
          key={fieldPath.join(".")}
          className="space-y-3 p-3 rounded-lg border border-slate-200 bg-slate-50"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">{toLabel(fieldName)}</h4>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleArrayAdd(resolvedFieldPath, fieldName, resolvedValue)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {resolvedValue.length === 0 ? (
            <p className="text-xs text-slate-500">No items yet.</p>
          ) : (
            resolvedValue.map((entry, index) => {
              const itemPath = [...resolvedFieldPath, index];
              return (
                <div
                  key={`${fieldPath.join(".")}-${index}`}
                  className="rounded-md border border-slate-200 bg-white p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-600">
                      {toLabel(fieldName)} #{index + 1}
                    </p>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleArrayRemove(resolvedFieldPath, resolvedValue, index)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>

                  {isRecord(entry) ? (
                    <div className="space-y-3">
                      {Object.entries(entry).map(([childKey, childValue]) =>
                        renderField(
                          childKey,
                          childValue,
                          [...itemPath, childKey],
                          depth + 1,
                          entry
                        )
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700">
                        Value
                      </label>
                      {renderScalarField(fieldName, entry, itemPath)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      );
    }

    if (isRecord(resolvedValue)) {
      return (
        <div
          key={fieldPath.join(".")}
          className={`space-y-3 p-3 rounded-lg border border-slate-200 ${
            depth === 0 ? "bg-slate-50" : "bg-white"
          }`}
        >
          <h4 className="text-sm font-semibold text-slate-800">{toLabel(fieldName)}</h4>
          <div className="space-y-3">
            {Object.entries(resolvedValue).map(([childKey, childValue]) =>
              renderField(
                childKey,
                childValue,
                [...resolvedFieldPath, childKey],
                depth + 1,
                resolvedValue
              )
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={fieldPath.join(".")} className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{toLabel(fieldName)}</label>
        {renderScalarField(fieldName, resolvedValue, resolvedFieldPath)}
      </div>
    );
  };

  const collapsedTitle = titleOverride || (hasSavedIdentity ? displayTitle || String(item.id) : "");
  const expandedTitle = titleOverride || (hasSavedIdentity ? displayTitle || String(item.id) : "Editing draft");

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {!expanded ? (
        <div className="flex items-center justify-between p-3">
          <div className="min-w-0">
            {collapsedTitle ? (
              <div className="text-sm font-medium text-gray-900 truncate">
                {collapsedTitle}
              </div>
            ) : (
              <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">
                Draft item
              </div>
            )}
            {previewEntries.length > 0 && (
              <div className="text-xs text-gray-500 mt-1 flex gap-2">
                {previewEntries.map(([key, value]) => (
                  <div key={key} className="truncate">
                    <span className="font-medium">{toLabel(key)}:</span>{" "}
                    <span className="opacity-90">{stringifyValue(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(true)}
              className="text-sm text-blue-600 px-3 py-2 rounded hover:bg-blue-50"
            >
              Edit
            </button>
            {!hideDeleteAction && (
              <button
                onClick={onDelete}
                disabled={disabled}
                className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b">
            <h3 className="text-sm font-semibold text-gray-900">
              {expandedTitle}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(false)}
                className="text-sm text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
              >
                Collapse
              </button>
              {!hideDeleteAction && (
                <button
                  onClick={onDelete}
                  disabled={disabled}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {fields
              .filter((field) => !filteredFieldSet || filteredFieldSet.has(field.name))
              .filter((field) => !hiddenKeys.has(field.name))
              .filter((field) => !isHiddenPath([field.name]))
              .filter((field) => {
                if (!enableLanguageEditing) return true;
                return !isLanguageVariantKey(field.name, languageCodes);
              })
              .map((field) =>
                renderField(field.name, item[field.name], [field.name], 0, item)
              )}
          </div>
        </div>
      )}
    </div>
  );
}
