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

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      {/* Header with Item ID */}
      <div className="flex items-center justify-between pb-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">
          Item #{item.id}
        </h3>
        <button
          onClick={onDelete}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      {/* Fields */}
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
  );
}
