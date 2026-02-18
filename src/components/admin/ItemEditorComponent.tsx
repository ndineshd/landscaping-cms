/**
 * Item Editor Component
 * Displays and edits item fields
 */

"use client";

import { useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { ImageUploadComponent } from "./ImageUploadComponent";
import type { DataItem, DynamicField } from "@/types/cms";
import { stringifyValue } from "@/lib/cms-utils";

interface ItemEditorComponentProps {
  /** Item to edit */
  item: DataItem;
  /** Available fields */
  fields: DynamicField[];
  /** Admin password */
  password: string;
  /** Callback when field changes */
  onFieldChange: (fieldName: string, value: unknown) => void;
  /** Callback to upload image */
  onImageUpload: (file: File) => void;
  /** Callback to delete item */
  onDelete: () => void;
  /** Whether component is disabled */
  disabled?: boolean;
}

/**
 * Item Editor Component
 */
export function ItemEditorComponent({
  item,
  fields,
  password,
  onFieldChange,
  onImageUpload,
  onDelete,
  disabled,
}: Readonly<ItemEditorComponentProps>) {
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [selectedImageField, setSelectedImageField] = useState<string | null>(
    null
  );
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {!expanded ? (
        <div className="flex items-center justify-between p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">Item #{item.id}</div>
            <div className="text-xs text-gray-500 mt-1 flex gap-2">
              {fields.slice(0, 2).map((f) => (
                <div key={f.name} className="truncate">
                  <span className="font-medium">{f.label}:</span>{" "}
                  <span className="opacity-90">{stringifyValue(item[f.name])}</span>
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
            <h3 className="text-sm font-semibold text-gray-900">Item #{item.id}</h3>
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
            {fields.map((field) => {
              const value = item[field.name];
              const isImageField = field.type === "image";

              return (
                <div key={field.name} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {field.label || field.name}
                  </label>

                  {isImageField ? (
                    // Image Field
                    <div className="space-y-2">
                      {typeof value === "string" && value && (
                        <div className="relative group">
                          <img
                            src={value}
                            alt={field.label}
                            className="w-full h-40 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => {
                              setSelectedImageField(field.name);
                              setShowImageUpload(true);
                            }}
                            disabled={disabled}
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/50 rounded-lg flex items-center justify-center transition-opacity"
                          >
                            <Upload className="h-6 w-6 text-white" />
                          </button>
                        </div>
                      )}

                      {typeof value !== "string" || (typeof value === "string" && !value) ? (
                        <button
                          onClick={() => {
                            setSelectedImageField(field.name);
                            setShowImageUpload(true);
                          }}
                          disabled={disabled || !password}
                          className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50"
                        >
                          <Upload className="h-4 w-4 inline mr-2" />
                          Upload Image
                        </button>
                      ) : null}

                      {showImageUpload && selectedImageField === field.name && (
                        <ImageUploadComponent
                          currentImage={typeof value === "string" ? value : undefined}
                          password={password}
                          onUpload={(file) => {
                            onImageUpload(file);
                            setShowImageUpload(false);
                          }}
                          disabled={disabled}
                        />
                      )}
                    </div>
                  ) : field.type === "boolean" ? (
                    // Boolean Field
                    <input
                      type="checkbox"
                      checked={value === true}
                      onChange={(e) => onFieldChange(field.name, e.target.checked)}
                      disabled={disabled}
                      className="h-4 w-4"
                    />
                  ) : field.type === "number" ? (
                    // Number Field
                    <input
                      type="number"
                      value={typeof value === "number" ? value : (value === undefined || value === null ? "" : String(value))}
                      onChange={(e) =>
                        onFieldChange(field.name, parseFloat(e.target.value))
                      }
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  ) : field.type === "array" ? (
                    // Array Field
                    <input
                      type="text"
                      value={stringifyValue(value)}
                      onChange={(e) =>
                        onFieldChange(
                          field.name,
                          e.target.value.split(",").map((item) => item.trim())
                        )
                      }
                      placeholder="Comma-separated values"
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  ) : (
                    // String Field (default)
                    <input
                      type="text"
                      value={stringifyValue(value)}
                      onChange={(e) => onFieldChange(field.name, e.target.value)}
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
