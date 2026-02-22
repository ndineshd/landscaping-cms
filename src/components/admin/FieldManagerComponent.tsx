/**
 * Field Manager Component
 * Manages dynamic fields
 */

"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DynamicField } from "@/types/cms";

interface FieldManagerComponentProps {
  /** Current fields */
  fields: DynamicField[];
  /** Callback to add field */
  onAddField: (name: string, type: string) => void;
  /** Callback to remove field */
  onRemoveField: (name: string) => void;
  /** Whether component is disabled */
  disabled?: boolean;
}

const FIELD_TYPES = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Checkbox" },
  { value: "array", label: "Array (comma-separated)" },
  { value: "image", label: "Image" },
];

/**
 * Field Manager Component
 */
export function FieldManagerComponent({
  fields,
  onAddField,
  onRemoveField,
  disabled,
}: Readonly<FieldManagerComponentProps>) {
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("string");
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * Handle add field
   */
  const handleAddField = () => {
    if (newFieldName.trim()) {
      onAddField(newFieldName.trim(), newFieldType);
      setNewFieldName("");
      setNewFieldType("string");
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium text-gray-900">Dynamic Fields</h3>
        <button onClick={() => setIsExpanded(!isExpanded)} className="text-sm text-blue-600 hover:underline">
          {isExpanded ? "Hide" : "Show"}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Current Fields */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Current Fields</p>
            <div className="flex flex-wrap gap-2">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded-md text-sm"
                >
                  <span className="text-sm text-gray-700">
                    {field.label} <span className="text-xs text-gray-500">({field.type})</span>
                  </span>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Are you sure you want to remove field "${field.name}"? This will remove it from all items.`
                        )
                      ) {
                        onRemoveField(field.name);
                      }
                    }}
                    disabled={disabled}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Field */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Add New Field
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Field Name
                </label>
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="e.g., tags, category"
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Field Type
                </label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAddField}
                disabled={disabled || !newFieldName.trim()}
                className="w-full px-4 py-2 bg-green-50 text-green-600 rounded hover:bg-green-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
