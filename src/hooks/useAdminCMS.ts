/**
 * Hook for managing admin CMS state and operations
 */

"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type {
  DataItem,
  DynamicField,
  APIResponse,
  ImageUploadPayload,
  ImageDeletePayload,
  JSONUpdatePayload,
} from "@/types/cms";
import { extractFieldsFromItems, detectFieldType, generateId } from "@/lib/cms-utils";

const LOCAL_ITEM_ID_KEY = "__localId";

function createLocalItemId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toSlug(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildAutoId(item: DataItem): string {
  const categorySlug = toSlug(item.category);
  const primarySlug = toSlug(item.title) || toSlug(item.name);

  if (categorySlug && primarySlug) {
    if (primarySlug === categorySlug) return categorySlug;
    if (primarySlug.startsWith(`${categorySlug}-`)) return primarySlug;
    return `${categorySlug}-${primarySlug}`;
  }

  if (primarySlug) return primarySlug;

  if (typeof item.id === "string") {
    return toSlug(item.id);
  }

  return "";
}

function hasAutoIdSource(item: DataItem): boolean {
  return (
    Object.prototype.hasOwnProperty.call(item, "id") &&
    (Object.prototype.hasOwnProperty.call(item, "title") ||
      Object.prototype.hasOwnProperty.call(item, "name") ||
      Object.prototype.hasOwnProperty.call(item, "category"))
  );
}

function stripLocalId(item: DataItem): DataItem {
  const cleaned = { ...item };
  delete cleaned[LOCAL_ITEM_ID_KEY];
  return cleaned;
}

function normalizeItem(item: DataItem): { item: DataItem; idChanged: boolean } {
  const localId =
    typeof item[LOCAL_ITEM_ID_KEY] === "string" && item[LOCAL_ITEM_ID_KEY]
      ? (item[LOCAL_ITEM_ID_KEY] as string)
      : createLocalItemId();

  let normalized: DataItem = {
    ...item,
    [LOCAL_ITEM_ID_KEY]: localId,
  };
  let idChanged = false;

  if (hasAutoIdSource(normalized)) {
    const nextId = buildAutoId(normalized);
    if (nextId && normalized.id !== nextId) {
      normalized = { ...normalized, id: nextId };
      idChanged = true;
    }
  }

  return { item: normalized, idChanged };
}

function normalizeItems(items: DataItem[]): { items: DataItem[]; idsChanged: boolean } {
  let idsChanged = false;
  const normalizedItems = items.map((item) => {
    const normalized = normalizeItem(item);
    if (normalized.idChanged) idsChanged = true;
    return normalized.item;
  });

  return { items: normalizedItems, idsChanged };
}

function detectFields(items: DataItem[]): DynamicField[] {
  const extractedFields = extractFieldsFromItems(items).filter(
    (field) => field !== LOCAL_ITEM_ID_KEY
  );

  return extractedFields.map((field) => {
    const sampleValue = items[0]?.[field];
    return {
      name: field,
      type: detectFieldType(sampleValue) as
        | "string"
        | "number"
        | "boolean"
        | "array"
        | "image",
      label: field.charAt(0).toUpperCase() + field.slice(1),
    };
  });
}

/**
 * Hook for admin CMS operations
 * @returns Admin hook with state and methods
 */
export function useAdminCMS() {
  const [items, setItems] = useState<DataItem[]>([]);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [itemsByFile, setItemsByFile] = useState<Record<string, DataItem[]>>({});
  const [fieldsByFile, setFieldsByFile] = useState<Record<string, DynamicField[]>>({});
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, boolean>>({});
  const [isArrayFileByPath, setIsArrayFileByPath] = useState<Record<string, boolean>>({});

  const persistFile = useCallback(
    async (filePath: string, fileItems: DataItem[], password: string): Promise<boolean> => {
      const sanitizedItems = fileItems.map(stripLocalId);
      const contentToSave =
        isArrayFileByPath[filePath] === false ? sanitizedItems[0] || {} : sanitizedItems;

      const payload: JSONUpdatePayload = {
        filePath,
        content: JSON.stringify(contentToSave, null, 2),
        password,
      };

      const response = await fetch("/api/update-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as APIResponse;
      return data.success;
    },
    [isArrayFileByPath]
  );

  /**
   * Load JSON data from GitHub
   * @param filePath - File path to load
   * @param password - Admin password
   * @param forceRemote - Skip local draft and fetch latest remote data
   */
  const loadData = useCallback(
    async (filePath: string, password: string, forceRemote = false) => {
      if (!filePath || !password) {
        toast.error("Please select a file and enter password");
        return;
      }

      if (!forceRemote && itemsByFile[filePath]) {
        setItems(itemsByFile[filePath]);
        setFields(fieldsByFile[filePath] || detectFields(itemsByFile[filePath]));
        setSelectedFile(filePath);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/get-json?filePath=${filePath}`);
        const data = (await response.json()) as APIResponse;

        if (!data.success) {
          toast.error(data.error || "Failed to load data");
          return;
        }

        const rawContent = (data.data as Record<string, unknown>).content;
        const isArrayContent = Array.isArray(rawContent);
        const loadedItems = (isArrayContent
          ? (rawContent as DataItem[])
          : [rawContent as DataItem]) as DataItem[];

        const normalized = normalizeItems(loadedItems);
        const detectedFields = detectFields(normalized.items);

        setItems(normalized.items);
        setFields(detectedFields);
        setSelectedFile(filePath);
        setItemsByFile((prev) => ({ ...prev, [filePath]: normalized.items }));
        setFieldsByFile((prev) => ({ ...prev, [filePath]: detectedFields }));
        setIsArrayFileByPath((prev) => ({ ...prev, [filePath]: isArrayContent }));
        setDirtyFiles((prev) => ({ ...prev, [filePath]: normalized.idsChanged }));

        if (normalized.idsChanged) {
          toast.info("IDs normalized to lowercase category-title format");
        } else {
          toast.success(forceRemote ? "Data reloaded successfully" : "Data loaded successfully");
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load data";
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [fieldsByFile, itemsByFile]
  );

  /**
   * Save data to GitHub for the current file
   * @param filePath - File path to save
   * @param password - Admin password
   */
  const saveData = useCallback(
    async (filePath: string, password: string) => {
      if (!filePath || !password) {
        toast.error("Please select a file and enter password");
        return;
      }

      const fileItems = itemsByFile[filePath] || (selectedFile === filePath ? items : []);

      if (!fileItems || fileItems.length === 0) {
        toast.error("No items to save");
        return;
      }

      setIsLoading(true);
      try {
        const isSaved = await persistFile(filePath, fileItems, password);

        if (!isSaved) {
          toast.error("Failed to save data");
          return;
        }

        setDirtyFiles((prev) => ({ ...prev, [filePath]: false }));
        toast.success("Data saved successfully");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to save data";
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [items, itemsByFile, persistFile, selectedFile]
  );

  /**
   * Save all unsaved file drafts to GitHub
   * @param password - Admin password
   */
  const saveAllData = useCallback(
    async (password: string) => {
      if (!password) {
        toast.error("Please enter password");
        return;
      }

      const dirtyFilePaths = Object.entries(dirtyFiles)
        .filter(([, isDirty]) => isDirty)
        .map(([filePath]) => filePath);

      if (dirtyFilePaths.length === 0) {
        toast.info("No pending changes");
        return;
      }

      setIsLoading(true);
      try {
        let successCount = 0;
        let failedCount = 0;

        for (const filePath of dirtyFilePaths) {
          const fileItems = itemsByFile[filePath] || [];
          if (fileItems.length === 0) {
            failedCount += 1;
            continue;
          }

          const isSaved = await persistFile(filePath, fileItems, password);
          if (isSaved) {
            successCount += 1;
            setDirtyFiles((prev) => ({ ...prev, [filePath]: false }));
          } else {
            failedCount += 1;
          }
        }

        if (successCount > 0) {
          toast.success(`Saved ${successCount} file(s)`);
        }

        if (failedCount > 0) {
          toast.error(`Failed to save ${failedCount} file(s)`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to save all data";
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [dirtyFiles, itemsByFile, persistFile]
  );

  /**
   * Update item field value
   * @param localItemId - Stable local item key
   * @param fieldName - Field name
   * @param value - New value
   */
  const updateItemField = useCallback(
    (localItemId: string, fieldName: string, value: unknown) => {
      if (!selectedFile) return;

      setItems((prevItems: DataItem[]) => {
        const updatedItems = prevItems.map((item: DataItem) => {
          if (item[LOCAL_ITEM_ID_KEY] !== localItemId) return item;

          let updatedItem: DataItem = { ...item, [fieldName]: value };
          const shouldRecomputeId =
            fieldName === "title" || fieldName === "name" || fieldName === "category";

          if (shouldRecomputeId && hasAutoIdSource(updatedItem)) {
            const nextId = buildAutoId(updatedItem);
            if (nextId) {
              updatedItem = { ...updatedItem, id: nextId };
            }
          }

          return updatedItem;
        });

        setItemsByFile((prev) => ({ ...prev, [selectedFile]: updatedItems }));
        setDirtyFiles((prev) => ({ ...prev, [selectedFile]: true }));
        return updatedItems;
      });
    },
    [selectedFile]
  );

  /**
   * Add new item
   */
  const addItem = useCallback(() => {
    if (!selectedFile) return;

    const hasIdField = fields.some((field) => field.name === "id");
    const newItem: DataItem = {
      [LOCAL_ITEM_ID_KEY]: createLocalItemId(),
      id: hasIdField ? "" : generateId(),
    };

    // Initialize with empty values for each field.
    fields.forEach((field: DynamicField) => {
      newItem[field.name] =
        field.type === "boolean"
          ? false
          : field.type === "array"
            ? []
            : field.type === "number"
              ? 0
              : "";
    });

    if (hasIdField && hasAutoIdSource(newItem)) {
      const nextId = buildAutoId(newItem);
      if (nextId) {
        newItem.id = nextId;
      }
    }

    setItems((prevItems: DataItem[]) => {
      const updatedItems = [newItem, ...prevItems];
      setItemsByFile((prev) => ({ ...prev, [selectedFile]: updatedItems }));
      setDirtyFiles((prev) => ({ ...prev, [selectedFile]: true }));
      return updatedItems;
    });

    toast.success("New item added");
  }, [fields, selectedFile]);

  /**
   * Delete item
   * @param localItemId - Stable local item key
   * @param password - Admin password
   */
  const deleteItem = useCallback(
    async (localItemId: string, password: string) => {
      if (!selectedFile) return;

      const item = items.find((i: DataItem) => i[LOCAL_ITEM_ID_KEY] === localItemId);
      if (!item) return;

      // Delete associated image if exists.
      const imageField = fields.find((f: DynamicField) => f.type === "image");
      if (imageField) {
        const imagePath = item[imageField.name] as string;
        if (imagePath && imagePath.startsWith("/uploads/")) {
          try {
            const payload: ImageDeletePayload = {
              filePath: `public${imagePath}`,
              password,
            };

            await fetch("/api/delete-image", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          } catch (error) {
            console.error("Failed to delete image:", error);
          }
        }
      }

      setItems((prevItems: DataItem[]) => {
        const updatedItems = prevItems.filter(
          (i: DataItem) => i[LOCAL_ITEM_ID_KEY] !== localItemId
        );
        setItemsByFile((prev) => ({ ...prev, [selectedFile]: updatedItems }));
        setDirtyFiles((prev) => ({ ...prev, [selectedFile]: true }));
        return updatedItems;
      });

      toast.success("Item deleted");
    },
    [fields, items, selectedFile]
  );

  /**
   * Upload image for item
   * @param localItemId - Stable local item key
   * @param file - Image file
   * @param password - Admin password
   */
  const uploadImage = useCallback(
    async (localItemId: string, file: File, password: string) => {
      if (!file) {
        toast.error("Please select an image");
        return;
      }

      setIsLoading(true);
      try {
        // TODO: Compress image and convert to base64.
        const reader = new FileReader();

        reader.onload = async () => {
          const base64Content = reader.result?.toString().split(",")[1] || "";

          const payload: ImageUploadPayload = {
            fileName: `img-${Date.now()}.${file.type.split("/")[1]}`,
            base64Content,
            password,
          };

          const response = await fetch("/api/upload-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = (await response.json()) as APIResponse;

          if (!data.success) {
            toast.error(data.error || "Failed to upload image");
            return;
          }

          const imagePath = (data.data as Record<string, unknown>).path as string;
          const imageField = fields.find((f: DynamicField) => f.type === "image");

          if (imageField) {
            updateItemField(localItemId, imageField.name, imagePath);
            toast.success("Image uploaded successfully");
          }
        };

        reader.readAsDataURL(file);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [fields, updateItemField]
  );

  /**
   * Add new field to all items
   * @param fieldName - Field name
   * @param fieldType - Field type
   */
  const addField = useCallback(
    (fieldName: string, fieldType: string) => {
      if (!fieldName) {
        toast.error("Field name is required");
        return;
      }

      if (fields.some((f: DynamicField) => f.name === fieldName)) {
        toast.error("Field already exists");
        return;
      }

      const newField: DynamicField = {
        name: fieldName,
        type: fieldType as
          | "string"
          | "number"
          | "boolean"
          | "array"
          | "image",
        label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
      };

      setFields((prevFields: DynamicField[]) => [...prevFields, newField]);

      const defaultValue =
        fieldType === "boolean"
          ? false
          : fieldType === "array"
            ? []
            : fieldType === "number"
              ? 0
              : "";

      setItems((prevItems: DataItem[]) => {
        const updatedItems = prevItems.map((item: DataItem) => ({
          ...item,
          [fieldName]: defaultValue,
        }));

        if (selectedFile) {
          setItemsByFile((prev) => ({ ...prev, [selectedFile]: updatedItems }));
          setFieldsByFile((prev) => ({
            ...prev,
            [selectedFile]: [...fields, newField],
          }));
          setDirtyFiles((prev) => ({ ...prev, [selectedFile]: true }));
        }

        return updatedItems;
      });

      toast.success("Field added");
    },
    [fields, selectedFile]
  );

  /**
   * Remove field from all items
   * @param fieldName - Field name to remove
   */
  const removeField = useCallback(
    (fieldName: string) => {
      setFields((prevFields: DynamicField[]) =>
        prevFields.filter((f: DynamicField) => f.name !== fieldName)
      );

      setItems((prevItems: DataItem[]) => {
        const updatedItems = prevItems.map((item: DataItem) => {
          const newItem = { ...item };
          delete newItem[fieldName];
          return newItem;
        });

        if (selectedFile) {
          setItemsByFile((prev) => ({ ...prev, [selectedFile]: updatedItems }));
          setFieldsByFile((prev) => ({
            ...prev,
            [selectedFile]: fields.filter((f: DynamicField) => f.name !== fieldName),
          }));
          setDirtyFiles((prev) => ({ ...prev, [selectedFile]: true }));
        }

        return updatedItems;
      });

      toast.success("Field removed");
    },
    [fields, selectedFile]
  );

  return {
    items,
    fields,
    selectedFile,
    isLoading,
    dirtyFiles,
    loadData,
    saveData,
    saveAllData,
    updateItemField,
    addItem,
    deleteItem,
    uploadImage,
    addField,
    removeField,
    setItems,
    setFields,
  };
}
