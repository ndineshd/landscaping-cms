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
import {
  CMS_FILES,
  extractFieldsFromItems,
  detectFieldType,
  generateId,
} from "@/lib/cms-utils";
import {
  compressImage,
  calculateFileHash,
  DEFAULT_COMPRESSION_OPTIONS,
  fileToBase64,
  generateDeterministicImageFileName,
} from "@/lib/image-compression";
import {
  applyLanguageConfigToAdminConfig,
  buildLocalizedFieldKey,
  extractLanguageConfig,
  type LanguageOption,
  normalizeLanguageConfig,
  normalizeLanguageCode,
  ensureLocalizedContentItems,
  DEFAULT_LANGUAGE_CODE,
  isLanguageVariantKey,
  isTranslatableTextField,
} from "@/lib/language-utils";

const LOCAL_ITEM_ID_KEY = "__localId";
const LANGUAGE_AWARE_FILES = new Set<string>([
  CMS_FILES.PROJECTS,
  CMS_FILES.SERVICES,
]);
const ADMIN_CONFIG_LOCALIZED_SECTIONS = ["hero", "about", "contact"] as const;
const ADMIN_CONFIG_LOCALIZED_FIELD_PATHS = [
  ["site", "companyName"],
  ["site", "tagline"],
  ["site", "description"],
  ["seo", "title"],
  ["seo", "description"],
] as const;
const LANGUAGE_DEPENDENT_FILES = [
  CMS_FILES.PROJECTS,
  CMS_FILES.SERVICES,
  CMS_FILES.TRANSLATIONS,
] as const;
const IMAGE_UPLOAD_COMPRESSION_OPTIONS = {
  ...DEFAULT_COMPRESSION_OPTIONS,
  maxSizeMB: 0.35,
  maxWidthOrHeight: 1400,
  initialQuality: 0.8,
};
const PROJECT_GALLERY_VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024;
const PROJECT_GALLERY_VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov"];
const PROJECT_GALLERY_VIDEO_MIME_TYPES = new Set<string>([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);
const GET_JSON_PASSWORD_HEADER = "x-admin-password";

interface SaveAllResult {
  successCount: number;
  failedCount: number;
  publishedFiles: string[];
}

interface TranslationTarget {
  sourceText: string;
  currentText: string;
  apply: (translated: string) => void;
}

function createLocalItemId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function fetchCMSFile(
  filePath: string,
  password: string
): Promise<APIResponse<{ content: unknown; sha: string }>> {
  const query = new URLSearchParams({ filePath });
  const response = await fetch(`/api/get-json?${query.toString()}`, {
    headers: {
      [GET_JSON_PASSWORD_HEADER]: password,
    },
  });
  return (await response.json()) as APIResponse<{ content: unknown; sha: string }>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasMeaningfulContent(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasMeaningfulContent(entry));
  }
  if (isRecord(value)) {
    return Object.entries(value).some(([key, entry]) => {
      if (key === LOCAL_ITEM_ID_KEY || key === "id") return false;
      return hasMeaningfulContent(entry);
    });
  }
  return false;
}

function shouldPersistArrayItem(item: DataItem): boolean {
  const titleValue = item.title;
  if (typeof titleValue === "string" && titleValue.trim().length === 0) {
    return false;
  }

  const hasTitleField = Object.prototype.hasOwnProperty.call(item, "title");
  if (!hasTitleField && Object.prototype.hasOwnProperty.call(item, "name")) {
    const nameValue = item.name;
    if (typeof nameValue === "string" && nameValue.trim().length === 0) {
      return false;
    }
  }

  return Object.entries(item).some(([key, value]) => {
    if (key === LOCAL_ITEM_ID_KEY || key === "id") return false;
    return hasMeaningfulContent(value);
  });
}

function isManagedUploadPath(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("/uploads/");
}

function extractManagedUploadPathsFromString(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("/uploads/"));
}

function collectManagedUploadPaths(value: unknown): string[] {
  const paths = new Set<string>();

  const walk = (node: unknown) => {
    if (typeof node === "string") {
      extractManagedUploadPathsFromString(node).forEach((path) => paths.add(path));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((entry) => walk(entry));
      return;
    }
    if (isRecord(node)) {
      Object.values(node).forEach((entry) => walk(entry));
    }
  };

  walk(value);
  return Array.from(paths);
}

function countManagedUploadPathReferences(value: unknown, targetPath: string): number {
  let count = 0;

  const walk = (node: unknown) => {
    if (typeof node === "string") {
      const matches = node
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry === targetPath);
      count += matches.length;
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((entry) => walk(entry));
      return;
    }
    if (isRecord(node)) {
      Object.values(node).forEach((entry) => walk(entry));
    }
  };

  walk(value);
  return count;
}

function countManagedUploadPathReferencesInFiles(
  itemsByFile: Record<string, DataItem[]>,
  targetPath: string
): number {
  return Object.values(itemsByFile).reduce((total, fileItems) => {
    return (
      total +
      fileItems.reduce((fileTotal, item) => {
        return fileTotal + countManagedUploadPathReferences(item, targetPath);
      }, 0)
    );
  }, 0);
}

function extractManagedUploadHash(imagePath: string): string | null {
  const normalizedPath = imagePath.trim().toLowerCase();
  const match = normalizedPath.match(
    /\/img-([a-f0-9]{16,64})\.(jpg|jpeg|png|webp|mp4|webm|ogg|mov)$/
  );
  return match ? match[1] : null;
}

function findManagedUploadPathByHash(
  itemsByFile: Record<string, DataItem[]>,
  targetHash: string
): string | null {
  const normalizedTargetHash = targetHash.trim().toLowerCase();
  if (!normalizedTargetHash) return null;

  for (const fileItems of Object.values(itemsByFile)) {
    for (const item of fileItems) {
      const paths = collectManagedUploadPaths(item);
      for (const path of paths) {
        if (extractManagedUploadHash(path) === normalizedTargetHash) {
          return path;
        }
      }
    }
  }

  return null;
}

function resolveImageUploadFolder(_filePath: string, _fieldPath: (string | number)[]): string {
  // Keep all uploads under one root path: /public/uploads/
  return "";
}

function isProjectGalleryField(filePath: string, fieldPath: (string | number)[]): boolean {
  if (filePath !== CMS_FILES.PROJECTS) return false;
  const firstSegment = fieldPath[0];
  return typeof firstSegment === "string" && firstSegment === "images";
}

function isProjectGalleryVideoFile(file: File): boolean {
  const fileType = file.type.trim().toLowerCase();
  if (PROJECT_GALLERY_VIDEO_MIME_TYPES.has(fileType)) {
    return true;
  }

  const lowerName = file.name.trim().toLowerCase();
  return PROJECT_GALLERY_VIDEO_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension)
  );
}

function normalizeProjectShowGalleryValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    return false;
  }

  if (value === undefined) return true;
  return false;
}

function normalizeProjectItems(items: DataItem[]): { items: DataItem[]; changed: boolean } {
  let changed = false;
  const normalizedItems = items.map((item) => {
    const nextItem = { ...item };

    if (Object.prototype.hasOwnProperty.call(nextItem, "services")) {
      delete nextItem.services;
      changed = true;
    }

    const normalizedShowGallery = normalizeProjectShowGalleryValue(nextItem.showGallery);
    if (nextItem.showGallery !== normalizedShowGallery) {
      nextItem.showGallery = normalizedShowGallery;
      changed = true;
    }

    return nextItem;
  });

  return { items: normalizedItems, changed };
}

function createFallbackStringArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
}

function createFallbackLocationArray(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value)) return [];

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const url = typeof value.url === "string" ? value.url.trim() : "";
  if (!name && !url) return [];

  return [{ ...value, name, url }];
}

function ensureAdminContactCollections(item: DataItem): { item: DataItem; changed: boolean } {
  if (!isRecord(item.contact)) {
    return { item, changed: false };
  }

  let changed = false;
  const contact = { ...item.contact };

  if (!Array.isArray(contact.phoneNumbers)) {
    contact.phoneNumbers = createFallbackStringArray(contact.phone);
    changed = true;
  }
  if (!Array.isArray(contact.emails)) {
    contact.emails = createFallbackStringArray(contact.email);
    changed = true;
  }
  if (!Array.isArray(contact.addresses)) {
    contact.addresses = createFallbackStringArray(contact.address);
    changed = true;
  }
  if (!Array.isArray(contact.locations)) {
    contact.locations = createFallbackLocationArray(contact.location);
    changed = true;
  }
  if (!Array.isArray(contact.timings)) {
    contact.timings = [];
    changed = true;
  }

  if (!changed) {
    return { item, changed: false };
  }

  return {
    item: {
      ...item,
      contact,
    },
    changed: true,
  };
}

function ensureLocalizedAdminConfigItem(
  item: DataItem,
  languageCodes: string[],
  defaultLanguage: string
): { item: DataItem; changed: boolean } {
  let changed = false;
  let nextItem = { ...item };

  const normalizedContact = ensureAdminContactCollections(nextItem);
  if (normalizedContact.changed) {
    nextItem = normalizedContact.item;
    changed = true;
  }

  ADMIN_CONFIG_LOCALIZED_SECTIONS.forEach((sectionKey) => {
    const sectionValue = nextItem[sectionKey];
    if (!sectionValue || typeof sectionValue !== "object") {
      return;
    }

    const sectionContainer: DataItem = {
      id: sectionKey,
      value: sectionValue,
    };
    const localizedSection = ensureLocalizedContentItems(
      [sectionContainer],
      languageCodes,
      defaultLanguage
    );
    const localizedValue = localizedSection.items[0]?.value;

    if (localizedSection.changed && localizedValue !== undefined) {
      nextItem = {
        ...nextItem,
        [sectionKey]: localizedValue,
      };
      changed = true;
    }
  });

  ADMIN_CONFIG_LOCALIZED_FIELD_PATHS.forEach((fieldPath) => {
    const parentPath = fieldPath.slice(0, -1);
    const fieldKey = fieldPath[fieldPath.length - 1];
    const parentValue = getValueAtPath(nextItem, parentPath as string[]);
    if (!isRecord(parentValue)) {
      return;
    }

    const localizedRecord = localizeRecordFieldByKey(
      parentValue,
      fieldKey,
      languageCodes,
      defaultLanguage
    );
    if (!localizedRecord.changed) {
      return;
    }

    nextItem = setValueAtPath(
      nextItem,
      parentPath as (string | number)[],
      localizedRecord.record
    );
    changed = true;
  });

  return { item: nextItem, changed };
}

function getValueAtPath(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function localizeRecordFieldByKey(
  record: Record<string, unknown>,
  fieldKey: string,
  languageCodes: string[],
  defaultLanguage: string
): { record: Record<string, unknown>; changed: boolean } {
  if (!Object.prototype.hasOwnProperty.call(record, fieldKey)) {
    return { record, changed: false };
  }

  const localizableFieldState: DataItem = {
    id: fieldKey,
    [fieldKey]: record[fieldKey],
  };

  Object.entries(record).forEach(([key, value]) => {
    if (key.startsWith(`${fieldKey}_`)) {
      localizableFieldState[key] = value;
    }
  });

  const localized = ensureLocalizedContentItems(
    [localizableFieldState],
    languageCodes,
    defaultLanguage
  );
  const localizedFieldState = localized.items[0];
  if (!localizedFieldState) {
    return { record, changed: false };
  }

  const nextRecord: Record<string, unknown> = { ...record };
  Object.keys(nextRecord).forEach((key) => {
    if (key.startsWith(`${fieldKey}_`)) {
      delete nextRecord[key];
    }
  });

  Object.entries(localizedFieldState).forEach(([key, value]) => {
    if (key === "id") return;
    if (key === fieldKey || key.startsWith(`${fieldKey}_`)) {
      nextRecord[key] = value;
    }
  });

  return {
    record: nextRecord,
    changed: JSON.stringify(record) !== JSON.stringify(nextRecord),
  };
}

function normalizeItem(
  item: DataItem,
  options?: { autoGenerateId?: boolean }
): { item: DataItem; idChanged: boolean } {
  const localId =
    typeof item[LOCAL_ITEM_ID_KEY] === "string" && item[LOCAL_ITEM_ID_KEY]
      ? (item[LOCAL_ITEM_ID_KEY] as string)
      : createLocalItemId();

  let normalized: DataItem = {
    ...item,
    [LOCAL_ITEM_ID_KEY]: localId,
  };
  let idChanged = false;

  if (options?.autoGenerateId !== false && hasAutoIdSource(normalized)) {
    const nextId = buildAutoId(normalized);
    if (nextId && normalized.id !== nextId) {
      normalized = { ...normalized, id: nextId };
      idChanged = true;
    }
  }

  return { item: normalized, idChanged };
}

function normalizeItems(
  items: DataItem[],
  options?: { autoGenerateId?: boolean }
): { items: DataItem[]; idsChanged: boolean } {
  let idsChanged = false;
  const normalizedItems = items.map((item) => {
    const normalized = normalizeItem(item, options);
    if (normalized.idChanged) idsChanged = true;
    return normalized.item;
  });

  return { items: normalizedItems, idsChanged };
}

function cloneDataItems(items: DataItem[]): DataItem[] {
  if (typeof structuredClone === "function") {
    return structuredClone(items) as DataItem[];
  }
  return JSON.parse(JSON.stringify(items)) as DataItem[];
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined || override === null) {
    return base;
  }

  if (
    typeof base === "object" &&
    base !== null &&
    !Array.isArray(base) &&
    typeof override === "object" &&
    override !== null &&
    !Array.isArray(override)
  ) {
    const merged: Record<string, unknown> = {
      ...(base as Record<string, unknown>),
    };

    Object.entries(override as Record<string, unknown>).forEach(
      ([key, value]) => {
        merged[key] = deepMerge(merged[key], value);
      }
    );

    return merged;
  }

  return override;
}

function ensureTranslationsForLanguages(
  rawTranslations: Record<string, unknown>,
  languageCodes: string[],
  defaultLanguage: string
): { translations: Record<string, unknown>; changed: boolean } {
  const normalizedLanguageCodes = Array.from(
    new Set(languageCodes.map((code) => normalizeLanguageCode(code)).filter(Boolean))
  );
  const normalizedDefault = normalizeLanguageCode(defaultLanguage || DEFAULT_LANGUAGE_CODE);
  const sanitizedTranslations: Record<string, Record<string, unknown>> = {};
  const preservedMetadata: Record<string, unknown> = {};
  let changed = false;

  Object.entries(rawTranslations).forEach(([key, value]) => {
    const normalizedCode = normalizeLanguageCode(key);
    const isConfiguredLanguage = normalizedLanguageCodes.includes(normalizedCode);

    if (!isConfiguredLanguage) {
      const looksLikeLanguageCode = /^[a-z]{2,8}$/.test(normalizedCode);
      if (looksLikeLanguageCode) {
        changed = true;
        return;
      }

      preservedMetadata[key] = value;
      return;
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      changed = true;
      return;
    }

    if (key !== normalizedCode) {
      changed = true;
    }

    const current = sanitizedTranslations[normalizedCode];
    if (!current) {
      sanitizedTranslations[normalizedCode] = value as Record<string, unknown>;
      return;
    }

    const merged = deepMerge(current, value) as Record<string, unknown>;
    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      changed = true;
      sanitizedTranslations[normalizedCode] = merged;
      return;
    }

    changed = true;
  });

  const firstLanguageCode = Object.keys(sanitizedTranslations)[0];
  const fallbackLanguageCode = normalizedLanguageCodes.includes(normalizedDefault)
    ? normalizedDefault
    : DEFAULT_LANGUAGE_CODE;
  const fallback = (sanitizedTranslations[fallbackLanguageCode] ||
    sanitizedTranslations[DEFAULT_LANGUAGE_CODE] ||
    (firstLanguageCode ? sanitizedTranslations[firstLanguageCode] : {})) as Record<
    string,
    unknown
  >;
  const normalizedTranslations: Record<string, unknown> = {};

  normalizedLanguageCodes.forEach((code) => {
    const current = sanitizedTranslations[code];
    const merged = deepMerge(fallback, current || {}) as Record<string, unknown>;
    normalizedTranslations[code] = merged;
    if (!current || JSON.stringify(current) !== JSON.stringify(merged)) {
      changed = true;
    }
  });

  const mergedResult: Record<string, unknown> = {
    ...preservedMetadata,
    ...normalizedTranslations,
  };

  if (JSON.stringify(rawTranslations) !== JSON.stringify(mergedResult)) {
    changed = true;
  }

  return { translations: mergedResult, changed };
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function collectLocalizedTranslationTargets(
  node: unknown,
  targetLanguageCode: string,
  languageCodes: string[],
  targets: TranslationTarget[]
): void {
  if (Array.isArray(node)) {
    node.forEach((entry) =>
      collectLocalizedTranslationTargets(entry, targetLanguageCode, languageCodes, targets)
    );
    return;
  }

  if (!isRecord(node)) {
    return;
  }

  const effectiveLanguageCodes = Array.from(
    new Set([...languageCodes, normalizeLanguageCode(targetLanguageCode)])
  );
  const record = node as Record<string, unknown>;

  Object.entries(record).forEach(([key, value]) => {
    if (isLanguageVariantKey(key, effectiveLanguageCodes)) {
      return;
    }

    if (isTranslatableTextField(key, value, effectiveLanguageCodes)) {
      const localizedKey = buildLocalizedFieldKey(key, targetLanguageCode);

      if (Object.prototype.hasOwnProperty.call(record, localizedKey)) {
        const sourceText = value as string;
        const localizedValue = record[localizedKey];
        const currentText = typeof localizedValue === "string" ? localizedValue : "";
        const canAutoTranslate =
          sourceText.trim().length > 0 &&
          (currentText.trim().length === 0 || currentText === sourceText);

        if (canAutoTranslate) {
          targets.push({
            sourceText,
            currentText,
            apply: (translated) => {
              record[localizedKey] = translated;
            },
          });
        }
      }
    }

    collectLocalizedTranslationTargets(value, targetLanguageCode, languageCodes, targets);
  });
}

function collectStringTranslationTargets(
  node: unknown,
  targets: TranslationTarget[]
): void {
  if (Array.isArray(node)) {
    node.forEach((entry, index) => {
      if (typeof entry === "string") {
        if (!entry.trim()) return;
        targets.push({
          sourceText: entry,
          currentText: entry,
          apply: (translated) => {
            node[index] = translated;
          },
        });
        return;
      }

      collectStringTranslationTargets(entry, targets);
    });
    return;
  }

  if (!isRecord(node)) {
    return;
  }

  const record = node as Record<string, unknown>;
  Object.entries(record).forEach(([key, value]) => {
    if (typeof value === "string") {
      if (!value.trim()) return;
      targets.push({
        sourceText: value,
        currentText: value,
        apply: (translated) => {
          record[key] = translated;
        },
      });
      return;
    }

    collectStringTranslationTargets(value, targets);
  });
}

async function translateTextsWithGoogle(
  texts: string[],
  sourceLanguageCode: string,
  targetLanguageCode: string,
  password: string
): Promise<{ translations: string[]; failedCount: number }> {
  if (texts.length === 0) {
    return { translations: [], failedCount: 0 };
  }

  if (normalizeLanguageCode(sourceLanguageCode) === normalizeLanguageCode(targetLanguageCode)) {
    return { translations: texts, failedCount: 0 };
  }

  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password,
      sourceLanguage: sourceLanguageCode,
      targetLanguage: targetLanguageCode,
      texts,
    }),
  });

  const data = (await response.json()) as APIResponse;
  if (!data.success) {
    throw new Error(data.error || "Failed to translate content");
  }

  const responseData = (data.data || {}) as Record<string, unknown>;
  const translations = Array.isArray(responseData.translations)
    ? responseData.translations
        .map((value) => (typeof value === "string" ? value : ""))
        .slice(0, texts.length)
    : [];
  const safeTranslations =
    translations.length === texts.length
      ? translations
      : texts.map((text, index) => translations[index] || text);

  return {
    translations: safeTranslations,
    failedCount:
      typeof responseData.failedCount === "number" ? responseData.failedCount : 0,
  };
}

async function autoTranslateLocalizedItems(
  items: DataItem[],
  languageCodes: string[],
  sourceLanguageCode: string,
  targetLanguageCode: string,
  password: string
): Promise<{ items: DataItem[]; changed: boolean; failedCount: number }> {
  const clonedItems = cloneJsonValue(items);
  const targets: TranslationTarget[] = [];
  clonedItems.forEach((item) =>
    collectLocalizedTranslationTargets(item, targetLanguageCode, languageCodes, targets)
  );

  if (targets.length === 0) {
    return { items, changed: false, failedCount: 0 };
  }

  const uniqueTexts = Array.from(new Set(targets.map((target) => target.sourceText)));
  const translated = await translateTextsWithGoogle(
    uniqueTexts,
    sourceLanguageCode,
    targetLanguageCode,
    password
  );
  const translationMap = new Map<string, string>();
  uniqueTexts.forEach((text, index) => {
    translationMap.set(text, translated.translations[index] || text);
  });

  let changed = false;
  targets.forEach((target) => {
    const nextValue = translationMap.get(target.sourceText) || target.sourceText;
    if (nextValue !== target.currentText) {
      target.apply(nextValue);
      changed = true;
    }
  });

  return {
    items: changed ? clonedItems : items,
    changed,
    failedCount: translated.failedCount,
  };
}

async function autoTranslateRecordStrings(
  value: Record<string, unknown>,
  sourceLanguageCode: string,
  targetLanguageCode: string,
  password: string
): Promise<{ value: Record<string, unknown>; changed: boolean; failedCount: number }> {
  const clonedRecord = cloneJsonValue(value);
  const targets: TranslationTarget[] = [];
  collectStringTranslationTargets(clonedRecord, targets);

  if (targets.length === 0) {
    return { value, changed: false, failedCount: 0 };
  }

  const uniqueTexts = Array.from(new Set(targets.map((target) => target.sourceText)));
  const translated = await translateTextsWithGoogle(
    uniqueTexts,
    sourceLanguageCode,
    targetLanguageCode,
    password
  );
  const translationMap = new Map<string, string>();
  uniqueTexts.forEach((text, index) => {
    translationMap.set(text, translated.translations[index] || text);
  });

  let changed = false;
  targets.forEach((target) => {
    const nextValue = translationMap.get(target.sourceText) || target.sourceText;
    if (nextValue !== target.currentText) {
      target.apply(nextValue);
      changed = true;
    }
  });

  return {
    value: changed ? clonedRecord : value,
    changed,
    failedCount: translated.failedCount,
  };
}

function setValueAtPath(
  source: DataItem,
  path: (string | number)[],
  value: unknown
): DataItem {
  if (path.length === 0) return source;

  const rootCopy: Record<string, unknown> = { ...source };
  let current: Record<string, unknown> = rootCopy;

  for (let index = 0; index < path.length - 1; index++) {
    const segment = path[index] as string | number;
    const nextSegment = path[index + 1];
    const currentValue = current[segment as keyof typeof current];

    if (Array.isArray(currentValue)) {
      current[segment as keyof typeof current] = [...currentValue];
    } else if (currentValue && typeof currentValue === "object") {
      current[segment as keyof typeof current] = {
        ...(currentValue as Record<string, unknown>),
      };
    } else {
      current[segment as keyof typeof current] =
        typeof nextSegment === "number" ? [] : {};
    }

    current = current[segment as keyof typeof current] as Record<string, unknown>;
  }

  const lastSegment = path[path.length - 1];
  current[lastSegment as keyof typeof current] = value;

  return rootCopy as DataItem;
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

function isLanguageAwareFile(filePath: string): boolean {
  return LANGUAGE_AWARE_FILES.has(filePath);
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
  const [stagedFiles, setStagedFiles] = useState<Record<string, boolean>>({});
  const [resetSnapshotsByFile, setResetSnapshotsByFile] = useState<Record<string, DataItem[]>>(
    {}
  );
  const [resetSnapshotQueuedByFile, setResetSnapshotQueuedByFile] = useState<
    Record<string, boolean>
  >({});
  const [isArrayFileByPath, setIsArrayFileByPath] = useState<Record<string, boolean>>({});
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([
    { code: DEFAULT_LANGUAGE_CODE, name: "English" },
  ]);
  const [availableLanguageCodes, setAvailableLanguageCodes] = useState<string[]>([
    DEFAULT_LANGUAGE_CODE,
  ]);
  const [defaultLanguageCode, setDefaultLanguageCode] = useState(DEFAULT_LANGUAGE_CODE);
  const [activeLanguageCode, setActiveLanguageCode] = useState(DEFAULT_LANGUAGE_CODE);
  const isCurrentFileArray = selectedFile ? isArrayFileByPath[selectedFile] !== false : true;

  const applyLanguageState = useCallback(
    (
      languages: LanguageOption[],
      defaultCode: string,
      activeCodes?: string[]
    ) => {
      const normalized = normalizeLanguageConfig(languages, defaultCode, activeCodes);
      setLanguageOptions(normalized.languages);
      setAvailableLanguageCodes(normalized.activeLanguageCodes);
      setDefaultLanguageCode(normalized.defaultLanguage);
      setActiveLanguageCode((prevCode) =>
        normalized.activeLanguageCodes.includes(prevCode)
          ? prevCode
          : normalized.defaultLanguage
      );
    },
    []
  );

  const markFilesDirty = useCallback((filePaths: string[]) => {
    if (filePaths.length === 0) return;

    setDirtyFiles((prev) => {
      const next = { ...prev };
      filePaths.forEach((filePath) => {
        next[filePath] = true;
      });
      return next;
    });

    setStagedFiles((prev) => {
      const next = { ...prev };
      filePaths.forEach((filePath) => {
        next[filePath] = false;
      });
      return next;
    });
  }, []);

  const getEffectiveItemsByFile = useCallback((): Record<string, DataItem[]> => {
    if (!selectedFile) return itemsByFile;
    if (itemsByFile[selectedFile]) return itemsByFile;
    return {
      ...itemsByFile,
      [selectedFile]: items,
    };
  }, [items, itemsByFile, selectedFile]);

  const deleteManagedUploadIfUnreferenced = useCallback(
    async (
      imagePath: string,
      password: string,
      referencesBeingRemoved = 1
    ): Promise<boolean> => {
      if (!isManagedUploadPath(imagePath)) return false;
      if (referencesBeingRemoved <= 0) return false;

      const effectiveItemsByFile = getEffectiveItemsByFile();
      const totalReferences = countManagedUploadPathReferencesInFiles(
        effectiveItemsByFile,
        imagePath
      );

      if (totalReferences > referencesBeingRemoved) {
        return false;
      }

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
        return true;
      } catch (error) {
        console.error("Failed to delete image:", error);
        return false;
      }
    },
    [getEffectiveItemsByFile]
  );

  const persistFile = useCallback(
    async (filePath: string, fileItems: DataItem[], password: string): Promise<boolean> => {
      const sanitizedItems = fileItems.map(stripLocalId);
      const publishableItems =
        isArrayFileByPath[filePath] === false
          ? sanitizedItems
          : sanitizedItems.filter(shouldPersistArrayItem);
      const contentToSave =
        isArrayFileByPath[filePath] === false
          ? publishableItems[0] || {}
          : publishableItems;

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
    async (
      filePath: string,
      password: string,
      forceRemote = false
    ): Promise<boolean> => {
      if (!filePath || !password) {
        toast.error("Please select a file and enter password");
        return false;
      }

      if (!forceRemote && itemsByFile[filePath]) {
        const cachedItems =
          filePath === CMS_FILES.PROJECTS
            ? normalizeProjectItems(itemsByFile[filePath]).items
            : itemsByFile[filePath];
        const cachedFields =
          filePath === CMS_FILES.PROJECTS
            ? detectFields(cachedItems)
            : fieldsByFile[filePath] || detectFields(cachedItems);
        setItems(cachedItems);
        setFields(cachedFields);
        if (filePath === CMS_FILES.PROJECTS) {
          setItemsByFile((prev) => ({ ...prev, [filePath]: cachedItems }));
          setFieldsByFile((prev) => ({ ...prev, [filePath]: cachedFields }));
        }
        setSelectedFile(filePath);
        return true;
      }

      setIsLoading(true);
      try {
        const data = await fetchCMSFile(filePath, password);

        if (!data.success) {
          toast.error(data.error || "Failed to load data");
          return false;
        }

        let rawContent = (data.data as Record<string, unknown>).content;
        let translationsUpdated = false;
        let adminConfigUpdated = false;
        let localizedContentUpdated = false;
        let projectContentUpdated = false;
        let languageConfig = normalizeLanguageConfig(
          languageOptions,
          defaultLanguageCode,
          availableLanguageCodes
        );

        const resolveAdminLanguageConfig = async (): Promise<void> => {
          const cachedAdminRaw = itemsByFile[CMS_FILES.ADMIN_CONFIG]?.[0] as
            | Record<string, unknown>
            | undefined;
          let adminRaw: Record<string, unknown> | null = cachedAdminRaw || null;

          if (!adminRaw) {
            const adminConfigData = await fetchCMSFile(
              CMS_FILES.ADMIN_CONFIG,
              password
            );
            if (adminConfigData.success) {
              adminRaw = (adminConfigData.data as Record<string, unknown>)
                .content as Record<string, unknown>;
            }
          }

          if (adminRaw) {
            languageConfig = extractLanguageConfig(adminRaw);
            applyLanguageState(
              languageConfig.languages,
              languageConfig.defaultLanguage,
              languageConfig.activeLanguageCodes
            );
          }
        };

        if (
          filePath === CMS_FILES.ADMIN_CONFIG &&
          rawContent &&
          typeof rawContent === "object" &&
          !Array.isArray(rawContent)
        ) {
          const normalizedAdminConfig = applyLanguageConfigToAdminConfig(
            rawContent as Record<string, unknown>
          );
          const localizedAdminConfig = ensureLocalizedAdminConfigItem(
            normalizedAdminConfig.adminConfig as DataItem,
            normalizedAdminConfig.languageConfig.languageCodes,
            normalizedAdminConfig.languageConfig.defaultLanguage
          );
          rawContent = localizedAdminConfig.item;
          languageConfig = normalizedAdminConfig.languageConfig;
          adminConfigUpdated =
            normalizedAdminConfig.changed || localizedAdminConfig.changed;
          applyLanguageState(
            languageConfig.languages,
            languageConfig.defaultLanguage,
            languageConfig.activeLanguageCodes
          );
        } else if (
          filePath === CMS_FILES.TRANSLATIONS ||
          isLanguageAwareFile(filePath)
        ) {
          try {
            await resolveAdminLanguageConfig();
          } catch (error) {
            console.error("Failed to resolve site language configuration:", error);
          }
        }

        if (
          filePath === CMS_FILES.TRANSLATIONS &&
          rawContent &&
          typeof rawContent === "object" &&
          !Array.isArray(rawContent)
        ) {
          const ensuredTranslations = ensureTranslationsForLanguages(
            rawContent as Record<string, unknown>,
            languageConfig.languageCodes,
            languageConfig.defaultLanguage
          );
          rawContent = ensuredTranslations.translations;
          translationsUpdated = ensuredTranslations.changed;
        }

        const isArrayContent = Array.isArray(rawContent);
        let loadedItems = (isArrayContent
          ? (rawContent as DataItem[])
          : [rawContent as DataItem]) as DataItem[];

        if (filePath === CMS_FILES.PROJECTS) {
          const normalizedProjects = normalizeProjectItems(loadedItems);
          loadedItems = normalizedProjects.items;
          projectContentUpdated = normalizedProjects.changed;
        }

        if (isLanguageAwareFile(filePath)) {
          const localizedContent = ensureLocalizedContentItems(
            loadedItems,
            languageConfig.languageCodes,
            languageConfig.defaultLanguage
          );
          loadedItems = localizedContent.items;
          localizedContentUpdated = localizedContent.changed;
        }

        const normalized = normalizeItems(loadedItems, {
          autoGenerateId: filePath !== CMS_FILES.TRANSLATIONS,
        });
        const detectedFields = detectFields(normalized.items);

        setItems(normalized.items);
        setFields(detectedFields);
        setSelectedFile(filePath);
        setItemsByFile((prev) => ({ ...prev, [filePath]: normalized.items }));
        setFieldsByFile((prev) => ({ ...prev, [filePath]: detectedFields }));
        setResetSnapshotsByFile((prev) => ({
          ...prev,
          [filePath]: cloneDataItems(normalized.items),
        }));
        setResetSnapshotQueuedByFile((prev) => ({ ...prev, [filePath]: false }));
        setIsArrayFileByPath((prev) => ({ ...prev, [filePath]: isArrayContent }));
        // Loading/syncing remote data should not create draft state automatically.
        setDirtyFiles((prev) => ({ ...prev, [filePath]: false }));
        setStagedFiles((prev) => ({ ...prev, [filePath]: false }));

        if (normalized.idsChanged) {
          toast.info("IDs normalized to lowercase category-title format");
        } else if (projectContentUpdated) {
          toast.info("Project fields synced");
        } else if (adminConfigUpdated) {
          toast.info("Site config synced with language settings");
        } else if (translationsUpdated) {
          toast.info("Translations synced with site language config");
        } else if (localizedContentUpdated) {
          toast.info("Localized content fields synced with site language config");
        } else {
          toast.success(forceRemote ? "Data reloaded successfully" : "Data loaded successfully");
        }
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load data";
        toast.error(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [
      applyLanguageState,
      availableLanguageCodes,
      defaultLanguageCode,
      fieldsByFile,
      itemsByFile,
      languageOptions,
    ]
  );

  /**
   * Save data locally for the current file.
   * This stages changes for global publish.
   * @param filePath - File path to save
   */
  const saveData = useCallback(
    async (filePath: string) => {
      if (!filePath) {
        toast.error("Please select a file");
        return;
      }

      const filesToStage =
        filePath === CMS_FILES.ADMIN_CONFIG
          ? Object.entries(dirtyFiles)
              .filter(([, isDirty]) => isDirty)
              .map(([path]) => path)
          : dirtyFiles[filePath]
            ? [filePath]
            : [];

      if (filesToStage.length === 0) {
        toast.info("No local changes to save");
        return;
      }

      setStagedFiles((prev) => {
        const next = { ...prev };
        filesToStage.forEach((path) => {
          next[path] = true;
        });
        return next;
      });
      setResetSnapshotsByFile((prev) => {
        const next = { ...prev };
        filesToStage.forEach((path) => {
          const sourceItems =
            itemsByFile[path] || (selectedFile === path ? items : []);
          next[path] = cloneDataItems(sourceItems);
        });
        return next;
      });
      setResetSnapshotQueuedByFile((prev) => {
        const next = { ...prev };
        filesToStage.forEach((path) => {
          next[path] = true;
        });
        return next;
      });

      if (filesToStage.length === 1) {
        toast.success("Saved locally. Ready for global update.");
      } else {
        toast.success(
          `Saved locally. ${filesToStage.length} files are ready for global update.`
        );
      }
    },
    [dirtyFiles, items, itemsByFile, selectedFile]
  );

  /**
   * Publish staged file drafts to GitHub
   * @param password - Admin password
   */
  const saveAllData = useCallback(
    async (password: string): Promise<SaveAllResult | null> => {
      if (!password) {
        toast.error("Please enter password");
        return null;
      }

      const stagedFilePaths = Object.entries(stagedFiles)
        .filter(([, isStaged]) => isStaged)
        .map(([filePath]) => filePath);

      if (stagedFilePaths.length === 0) {
        toast.info("No queued local saves pending publish");
        return null;
      }

      setIsLoading(true);
      try {
        let successCount = 0;
        let failedCount = 0;
        const publishedFiles: string[] = [];
        const publishedSnapshots: Record<string, DataItem[]> = {};

        for (const filePath of stagedFilePaths) {
          const fileItems = itemsByFile[filePath] || [];
          if (fileItems.length === 0) {
            failedCount += 1;
            continue;
          }

          const isSaved = await persistFile(filePath, fileItems, password);
          if (isSaved) {
            successCount += 1;
            publishedFiles.push(filePath);
            publishedSnapshots[filePath] = cloneDataItems(fileItems);
            setDirtyFiles((prev) => ({ ...prev, [filePath]: false }));
            setStagedFiles((prev) => ({ ...prev, [filePath]: false }));
          } else {
            failedCount += 1;
          }
        }

        const publishedPaths = Object.keys(publishedSnapshots);
        if (publishedPaths.length > 0) {
          setResetSnapshotsByFile((prev) => ({ ...prev, ...publishedSnapshots }));
          setResetSnapshotQueuedByFile((prev) => {
            const next = { ...prev };
            publishedPaths.forEach((filePath) => {
              next[filePath] = false;
            });
            return next;
          });
        }

        if (successCount > 0) {
          toast.success(`Saved ${successCount} file(s)`);
        }

        if (failedCount > 0) {
          toast.error(`Failed to save ${failedCount} file(s)`);
        }

        return { successCount, failedCount, publishedFiles };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to save all data";
        toast.error(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [itemsByFile, persistFile, stagedFiles]
  );

  const resetDraftChanges = useCallback(
    (filePath: string): boolean => {
      if (!filePath) return false;

      const snapshot = resetSnapshotsByFile[filePath];
      if (!snapshot) {
        return false;
      }

      const restoredItems = cloneDataItems(snapshot);
      const restoredFields = detectFields(restoredItems);
      const restoreAsQueued = Boolean(resetSnapshotQueuedByFile[filePath]);

      setItemsByFile((prev) => ({ ...prev, [filePath]: restoredItems }));
      setFieldsByFile((prev) => ({ ...prev, [filePath]: restoredFields }));

      if (selectedFile === filePath) {
        setItems(restoredItems);
        setFields(restoredFields);
      }

      setDirtyFiles((prev) => ({ ...prev, [filePath]: restoreAsQueued }));
      setStagedFiles((prev) => ({ ...prev, [filePath]: restoreAsQueued }));

      toast.success(
        restoreAsQueued
          ? "Draft changes reset to last local save."
          : "Draft changes reset."
      );
      return true;
    },
    [resetSnapshotQueuedByFile, resetSnapshotsByFile, selectedFile]
  );

  /**
   * Update item field value
   * @param localItemId - Stable local item key
   * @param fieldPath - Field path
   * @param value - New value
   */
  const updateItemField = useCallback(
    (localItemId: string, fieldPath: (string | number)[], value: unknown) => {
      if (!selectedFile) return;

      setItems((prevItems: DataItem[]) => {
        const updatedItems = prevItems.map((item: DataItem) => {
          if (item[LOCAL_ITEM_ID_KEY] !== localItemId) return item;

          let updatedItem: DataItem = setValueAtPath(item, fieldPath, value);
          const topField = fieldPath[0];
          const shouldRecomputeId =
            fieldPath.length === 1 &&
            typeof topField === "string" &&
            (topField === "title" || topField === "name" || topField === "category") &&
            selectedFile !== CMS_FILES.TRANSLATIONS;

          if (shouldRecomputeId && hasAutoIdSource(updatedItem)) {
            const nextId = buildAutoId(updatedItem);
            if (nextId) {
              updatedItem = { ...updatedItem, id: nextId };
            }
          }

          return updatedItem;
        });

        setItemsByFile((prev) => ({ ...prev, [selectedFile]: updatedItems }));
        return updatedItems;
      });
      markFilesDirty([selectedFile]);
    },
    [markFilesDirty, selectedFile]
  );

  /**
   * Add new item
   */
  const addItem = useCallback(() => {
    if (!selectedFile) return;

    const hasIdField = fields.some((field) => field.name === "id");
    const configuredLanguageCodes = Array.from(
      new Set(
        languageOptions
          .map((language) => normalizeLanguageCode(language.code))
          .filter(Boolean)
      )
    );
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

    if (selectedFile === CMS_FILES.PROJECTS) {
      newItem.showGallery = true;
      delete newItem.services;
    }

    if (hasIdField && hasAutoIdSource(newItem)) {
      const nextId = buildAutoId(newItem);
      if (nextId) {
        newItem.id = nextId;
      }
    }

    setItems((prevItems: DataItem[]) => {
      let updatedItems = [newItem, ...prevItems];
      if (isLanguageAwareFile(selectedFile) && configuredLanguageCodes.length > 1) {
        const localized = ensureLocalizedContentItems(
          updatedItems,
          configuredLanguageCodes,
          defaultLanguageCode
        );
        updatedItems = localized.items;
      }
      setItemsByFile((prev) => ({ ...prev, [selectedFile]: updatedItems }));
      return updatedItems;
    });
    toast.success("New item added. Fill fields to enable local save.");
  }, [defaultLanguageCode, fields, languageOptions, selectedFile]);

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

      const imagePaths = collectManagedUploadPaths(item);
      if (imagePaths.length > 0) {
        await Promise.all(
          imagePaths.map(async (imagePath) => {
            const referencesInRemovedItem = countManagedUploadPathReferences(
              item,
              imagePath
            );
            await deleteManagedUploadIfUnreferenced(
              imagePath,
              password,
              referencesInRemovedItem
            );
          })
        );
      }

      setItems((prevItems: DataItem[]) => {
        const updatedItems = prevItems.filter(
          (i: DataItem) => i[LOCAL_ITEM_ID_KEY] !== localItemId
        );
        setItemsByFile((prev) => ({ ...prev, [selectedFile]: updatedItems }));
        return updatedItems;
      });
      markFilesDirty([selectedFile]);

      toast.success("Item deleted");
    },
    [deleteManagedUploadIfUnreferenced, items, markFilesDirty, selectedFile]
  );

  /**
   * Upload image for item
   * @param localItemId - Stable local item key
   * @param fieldPath - Field path to store uploaded image URL
   * @param file - Image file
   * @param password - Admin password
   */
  const uploadImage = useCallback(
    async (
      localItemId: string,
      fieldPath: (string | number)[],
      file: File,
      password: string,
      previousImagePath?: string
    ) => {
      if (!selectedFile) {
        toast.error("Select a file before uploading an image");
        return;
      }

      if (!file) {
        toast.error("Please select a file");
        return;
      }

      setIsLoading(true);
      try {
        const allowProjectGalleryVideo = isProjectGalleryField(selectedFile, fieldPath);
        const isVideoUpload = allowProjectGalleryVideo && isProjectGalleryVideoFile(file);

        if (isVideoUpload && file.size > PROJECT_GALLERY_VIDEO_MAX_SIZE_BYTES) {
          toast.error("Video size must be 50MB or less");
          return;
        }

        const originalFileHash = await calculateFileHash(file);
        const effectiveItemsByFile = getEffectiveItemsByFile();
        const reusedImagePath = findManagedUploadPathByHash(
          effectiveItemsByFile,
          originalFileHash
        );

        if (reusedImagePath) {
          if (reusedImagePath !== previousImagePath) {
            updateItemField(localItemId, fieldPath, reusedImagePath);

            if (isManagedUploadPath(previousImagePath)) {
              deleteManagedUploadIfUnreferenced(previousImagePath, password, 1).catch(
                (error) => {
                  console.error("Failed to remove previous image:", error);
                }
              );
            }
          }

          toast.success("File already exists. Linked existing path.");
          return;
        }

        let uploadFile = file;
        let compressionRatio = 0;

        if (!isVideoUpload) {
          const compressed = await compressImage(
            file,
            IMAGE_UPLOAD_COMPRESSION_OPTIONS
          );
          uploadFile = compressed.file;
          compressionRatio = compressed.ratio;
        }

        const base64Content = await fileToBase64(uploadFile);
        const uploadFolder = resolveImageUploadFolder(selectedFile, fieldPath);
        const payload: ImageUploadPayload = {
          fileName: generateDeterministicImageFileName(originalFileHash, file.name),
          base64Content,
          folder: uploadFolder || undefined,
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
        updateItemField(localItemId, fieldPath, imagePath);

        if (
          isManagedUploadPath(previousImagePath) &&
          previousImagePath !== imagePath
        ) {
          deleteManagedUploadIfUnreferenced(previousImagePath, password, 1).catch(
            (error) => {
              console.error("Failed to remove previous image:", error);
            }
          );
        }

        if (isVideoUpload) {
          toast.success("Media uploaded successfully");
        } else {
          toast.success(
            compressionRatio > 0
              ? `Image uploaded successfully (${compressionRatio.toFixed(1)}% smaller)`
              : "Image uploaded successfully"
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [
      deleteManagedUploadIfUnreferenced,
      getEffectiveItemsByFile,
      selectedFile,
      updateItemField,
    ]
  );

  const removeImage = useCallback(
    async (
      localItemId: string,
      fieldPath: (string | number)[],
      password: string,
      currentImagePath?: string
    ) => {
      if (isManagedUploadPath(currentImagePath)) {
        await deleteManagedUploadIfUnreferenced(currentImagePath, password, 1);
      }

      updateItemField(localItemId, fieldPath, "");
      toast.success("Image removed");
    },
    [deleteManagedUploadIfUnreferenced, updateItemField]
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
        }

        return updatedItems;
      });
      if (selectedFile) {
        markFilesDirty([selectedFile]);
      }

      toast.success("Field added");
    },
    [fields, markFilesDirty, selectedFile]
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
        }

        return updatedItems;
      });
      if (selectedFile) {
        markFilesDirty([selectedFile]);
      }

      toast.success("Field removed");
    },
    [fields, markFilesDirty, selectedFile]
  );

  const updateLanguageConfig = useCallback(
    async (
      languages: LanguageOption[],
      activeLanguageSelections: string[],
      defaultLanguage: string,
      adminPassword = ""
    ) => {
      const adminFileItems =
        itemsByFile[CMS_FILES.ADMIN_CONFIG] ||
        (selectedFile === CMS_FILES.ADMIN_CONFIG ? items : []);

      if (!adminFileItems.length) {
        toast.error("Load site configuration before updating languages");
        return;
      }

      setIsLoading(true);
      try {
        const normalizedLanguageConfig = normalizeLanguageConfig(
          languages,
          defaultLanguage,
          activeLanguageSelections
        );

        const currentAdminItem = adminFileItems[0] as Record<string, unknown>;
        const currentLanguageConfig = extractLanguageConfig(currentAdminItem);
        const newlyAddedLanguageCodes = normalizedLanguageConfig.languageCodes.filter(
          (languageCode) =>
            !currentLanguageConfig.languageCodes.includes(languageCode)
        );
        const normalizedAdmin = applyLanguageConfigToAdminConfig(
          currentAdminItem,
          normalizedLanguageConfig
        );
        const localizedAdminConfig = ensureLocalizedAdminConfigItem(
          normalizedAdmin.adminConfig as DataItem,
          normalizedLanguageConfig.languageCodes,
          normalizedLanguageConfig.defaultLanguage
        );
        const normalizedAdminItems = normalizeItems([
          localizedAdminConfig.item,
        ]).items;
        const changedFilePaths = new Set<string>();
        const nextItemsByFile: Record<string, DataItem[]> = {
          ...itemsByFile,
          [CMS_FILES.ADMIN_CONFIG]: normalizedAdminItems,
        };
        const nextFieldsByFile: Record<string, DynamicField[]> = {
          ...fieldsByFile,
          [CMS_FILES.ADMIN_CONFIG]: detectFields(normalizedAdminItems),
        };
        const nextArrayState: Record<string, boolean> = {
          ...isArrayFileByPath,
          [CMS_FILES.ADMIN_CONFIG]: false,
        };

        if (normalizedAdmin.changed || localizedAdminConfig.changed) {
          changedFilePaths.add(CMS_FILES.ADMIN_CONFIG);
        }

        const hydrateFileItems = async (filePath: string): Promise<DataItem[] | null> => {
          const cachedItems = nextItemsByFile[filePath];
          if (cachedItems && cachedItems.length > 0) {
            return cachedItems;
          }

          const data = await fetchCMSFile(filePath, adminPassword);
          if (!data.success) {
            throw new Error(data.error || `Failed to load ${filePath}`);
          }

          const rawContent = (data.data as Record<string, unknown>).content;
          const isArrayContent = Array.isArray(rawContent);
          const loadedItems = (isArrayContent
            ? (rawContent as DataItem[])
            : [rawContent as DataItem]) as DataItem[];
          const normalizedLoadedItems = normalizeItems(loadedItems, {
            autoGenerateId: filePath !== CMS_FILES.TRANSLATIONS,
          }).items;
          nextItemsByFile[filePath] = normalizedLoadedItems;
          nextFieldsByFile[filePath] = detectFields(normalizedLoadedItems);
          nextArrayState[filePath] = isArrayContent;
          return normalizedLoadedItems;
        };

        for (const filePath of LANGUAGE_DEPENDENT_FILES) {
          const fileItems = await hydrateFileItems(filePath);
          if (!fileItems || fileItems.length === 0) continue;

          if (filePath === CMS_FILES.TRANSLATIONS) {
            const translationItem = fileItems[0];
            const rawTranslations = { ...(translationItem as Record<string, unknown>) };
            delete rawTranslations[LOCAL_ITEM_ID_KEY];

            const ensuredTranslations = ensureTranslationsForLanguages(
              rawTranslations,
              normalizedLanguageConfig.languageCodes,
              normalizedLanguageConfig.defaultLanguage
            );

            if (!ensuredTranslations.changed) continue;

            const nextTranslationItem: DataItem = {
              id:
                typeof translationItem.id === "string" ||
                typeof translationItem.id === "number"
                  ? translationItem.id
                  : "translations",
              [LOCAL_ITEM_ID_KEY]: translationItem[LOCAL_ITEM_ID_KEY],
            };
            Object.entries(ensuredTranslations.translations).forEach(([key, value]) => {
              nextTranslationItem[key] = value;
            });

            nextItemsByFile[CMS_FILES.TRANSLATIONS] = [nextTranslationItem];
            nextFieldsByFile[CMS_FILES.TRANSLATIONS] = detectFields([nextTranslationItem]);
            changedFilePaths.add(CMS_FILES.TRANSLATIONS);
            continue;
          }

          const localized = ensureLocalizedContentItems(
            fileItems,
            normalizedLanguageConfig.languageCodes,
            normalizedLanguageConfig.defaultLanguage
          );

          if (!localized.changed) continue;

          nextItemsByFile[filePath] = localized.items;
          nextFieldsByFile[filePath] = detectFields(localized.items);
          changedFilePaths.add(filePath);
        }

        const translatedLanguageCodes: string[] = [];
        let totalTranslationFailures = 0;

        if (
          newlyAddedLanguageCodes.length > 0 &&
          adminPassword.trim().length > 0
        ) {
          for (const targetLanguageCode of newlyAddedLanguageCodes) {
            if (targetLanguageCode === normalizedLanguageConfig.defaultLanguage) {
              continue;
            }

            try {
              const sourceLanguageCode = normalizedLanguageConfig.defaultLanguage;
              const filesToTranslate = [
                CMS_FILES.ADMIN_CONFIG,
                CMS_FILES.PROJECTS,
                CMS_FILES.SERVICES,
              ] as const;

              for (const filePath of filesToTranslate) {
                const fileItems = nextItemsByFile[filePath];
                if (!fileItems || fileItems.length === 0) continue;

                const translated = await autoTranslateLocalizedItems(
                  fileItems,
                  normalizedLanguageConfig.languageCodes,
                  sourceLanguageCode,
                  targetLanguageCode,
                  adminPassword
                );
                totalTranslationFailures += translated.failedCount;

                if (!translated.changed) continue;
                nextItemsByFile[filePath] = translated.items;
                nextFieldsByFile[filePath] = detectFields(translated.items);
                changedFilePaths.add(filePath);
              }

              const translationItems = nextItemsByFile[CMS_FILES.TRANSLATIONS];
              if (translationItems && translationItems.length > 0) {
                const translationItem = translationItems[0];
                const languageValue = translationItem[targetLanguageCode];
                if (isRecord(languageValue)) {
                  const translatedLanguageSection = await autoTranslateRecordStrings(
                    languageValue,
                    sourceLanguageCode,
                    targetLanguageCode,
                    adminPassword
                  );
                  totalTranslationFailures +=
                    translatedLanguageSection.failedCount;

                  if (translatedLanguageSection.changed) {
                    const nextTranslationItem: DataItem = {
                      ...translationItem,
                      [targetLanguageCode]: translatedLanguageSection.value,
                    };
                    nextItemsByFile[CMS_FILES.TRANSLATIONS] = [nextTranslationItem];
                    nextFieldsByFile[CMS_FILES.TRANSLATIONS] = detectFields([
                      nextTranslationItem,
                    ]);
                    changedFilePaths.add(CMS_FILES.TRANSLATIONS);
                  }
                }
              }

              translatedLanguageCodes.push(targetLanguageCode);
            } catch (error) {
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : "Automatic translation failed";
              toast.warning(
                `Automatic translation failed for ${targetLanguageCode.toUpperCase()}: ${errorMessage}`
              );
            }
          }
        } else if (
          newlyAddedLanguageCodes.length > 0 &&
          adminPassword.trim().length === 0
        ) {
          toast.warning(
            "New language was added, but automatic translation was skipped (missing admin password)."
          );
        }

        setItemsByFile(nextItemsByFile);
        setFieldsByFile(nextFieldsByFile);
        setIsArrayFileByPath(nextArrayState);
        if (selectedFile && nextItemsByFile[selectedFile]) {
          setItems(nextItemsByFile[selectedFile]);
          setFields(
            nextFieldsByFile[selectedFile] || detectFields(nextItemsByFile[selectedFile])
          );
        }
        if (changedFilePaths.size > 0) {
          markFilesDirty([...changedFilePaths]);
          toast.success(
            `Language configuration updated. ${changedFilePaths.size} file(s) changed.`
          );
        } else {
          toast.info("Language configuration already up to date.");
        }
        if (translatedLanguageCodes.length > 0) {
          toast.success(
            `Automatic translation completed for ${translatedLanguageCodes
              .map((code) => code.toUpperCase())
              .join(", ")}.`
          );
        }
        if (totalTranslationFailures > 0) {
          toast.warning(
            `Some translation entries failed (${totalTranslationFailures}) and kept default text.`
          );
        }

        applyLanguageState(
          normalizedLanguageConfig.languages,
          normalizedLanguageConfig.defaultLanguage,
          normalizedLanguageConfig.activeLanguageCodes
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update language configuration";
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [
      applyLanguageState,
      fieldsByFile,
      isArrayFileByPath,
      items,
      itemsByFile,
      markFilesDirty,
      selectedFile,
    ]
  );

  return {
    items,
    fields,
    selectedFile,
    isLoading,
    isCurrentFileArray,
    dirtyFiles,
    stagedFiles,
    languageOptions,
    defaultLanguageCode,
    activeLanguageCode,
    availableLanguageCodes,
    loadData,
    saveData,
    saveAllData,
    resetDraftChanges,
    setActiveLanguageCode,
    updateLanguageConfig,
    updateItemField,
    addItem,
    deleteItem,
    uploadImage,
    removeImage,
    addField,
    removeField,
    setItems,
    setFields,
  };
}
