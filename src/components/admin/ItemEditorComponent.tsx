/**
 * Item Editor Component
 * Displays and edits item fields (supports nested objects and arrays)
 */

"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DataItem, DynamicField } from "@/types/cms";
import { stringifyValue } from "@/lib/cms-utils";

interface ItemEditorComponentProps {
  /** Item to edit */
  item: DataItem;
  /** Available fields */
  fields: DynamicField[];
  /** Admin password (kept for API compatibility) */
  password: string;
  /** Callback when field changes */
  onFieldChange: (fieldPath: (string | number)[], value: unknown) => void;
  /** Callback to upload image (kept for API compatibility) */
  onImageUpload: (file: File) => void;
  /** Callback to delete item */
  onDelete: () => void;
  /** If true, id is auto-generated from content fields */
  autoIdFromContent?: boolean;
  /** Whether component is disabled */
  disabled?: boolean;
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

/**
 * Item Editor Component
 */
export function ItemEditorComponent({
  item,
  fields,
  onFieldChange,
  onDelete,
  autoIdFromContent,
  disabled,
}: Readonly<ItemEditorComponentProps>) {
  const [expanded, setExpanded] = useState(false);
  const hiddenKeys = new Set<string>(["__localId"]);
  if (autoIdFromContent) hiddenKeys.add("id");

  const displayTitle = stringifyValue(item.title) || stringifyValue(item.name);
  const hasSavedIdentity =
    typeof item.id === "number" ||
    (typeof item.id === "string" && item.id.trim().length > 0);

  const previewEntries = Object.entries(item)
    .filter(([key, value]) => !hiddenKeys.has(key) && !isRecord(value) && !Array.isArray(value))
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
    depth = 0
  ): JSX.Element | null => {
    if (hiddenKeys.has(fieldName)) return null;

    if (Array.isArray(value)) {
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
              onClick={() => handleArrayAdd(fieldPath, fieldName, value)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {value.length === 0 ? (
            <p className="text-xs text-slate-500">No items yet.</p>
          ) : (
            value.map((entry, index) => {
              const itemPath = [...fieldPath, index];
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
                      onClick={() => handleArrayRemove(fieldPath, value, index)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>

                  {isRecord(entry) ? (
                    <div className="space-y-3">
                      {Object.entries(entry).map(([childKey, childValue]) =>
                        renderField(childKey, childValue, [...itemPath, childKey], depth + 1)
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

    if (isRecord(value)) {
      return (
        <div
          key={fieldPath.join(".")}
          className={`space-y-3 p-3 rounded-lg border border-slate-200 ${
            depth === 0 ? "bg-slate-50" : "bg-white"
          }`}
        >
          <h4 className="text-sm font-semibold text-slate-800">{toLabel(fieldName)}</h4>
          <div className="space-y-3">
            {Object.entries(value).map(([childKey, childValue]) =>
              renderField(childKey, childValue, [...fieldPath, childKey], depth + 1)
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={fieldPath.join(".")} className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{toLabel(fieldName)}</label>
        {renderScalarField(fieldName, value, fieldPath)}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {!expanded ? (
        <div className="flex items-center justify-between p-3">
          <div className="min-w-0">
            {hasSavedIdentity ? (
              <div className="text-sm font-medium text-gray-900 truncate">
                {displayTitle || String(item.id)}
              </div>
            ) : (
              <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">
                Draft item
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1 flex gap-2">
              {previewEntries.map(([key, value]) => (
                <div key={key} className="truncate">
                  <span className="font-medium">{toLabel(key)}:</span>{" "}
                  <span className="opacity-90">{stringifyValue(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(true)}
              className="text-sm text-blue-600 px-3 py-2 rounded hover:bg-blue-50"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b">
            <h3 className="text-sm font-semibold text-gray-900">
              {hasSavedIdentity ? displayTitle || String(item.id) : "Editing draft"}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(false)}
                className="text-sm text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
              >
                Collapse
              </button>
              <button
                onClick={onDelete}
                disabled={disabled}
                className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {fields
              .filter((field) => !hiddenKeys.has(field.name))
              .map((field) => renderField(field.name, item[field.name], [field.name]))}
          </div>
        </div>
      )}
    </div>
  );
}
