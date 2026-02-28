/**
 * Reusable helpers for the admin CMS hook.
 * Keeping pure logic here reduces hook size and improves testability.
 */

import type { APIResponse, DataItem, DynamicField, MediaUploadFieldState } from "@/types/cms";
import {
  CMS_FILES,
  detectFieldType,
  extractFieldsFromItems,
} from "@/lib/cms-utils";
import { DEFAULT_COMPRESSION_OPTIONS } from "@/lib/image-compression";
import {
  buildLocalizedFieldKey,
  ensureLocalizedContentItems,
  isLanguageVariantKey,
  isTranslatableTextField,
  normalizeLanguageCode,
  DEFAULT_LANGUAGE_CODE,
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
const MAX_DEPLOYED_BATCH_REQUEST_BYTES = 4 * 1024 * 1024;
const GET_JSON_PASSWORD_HEADER = "x-admin-password";

export interface SaveAllResult {
  successCount: number;
  failedCount: number;
  publishedFiles: string[];
  uploadedMediaCount: number;
  deletedMediaCount: number;
}

interface TranslationTarget {
  sourceText: string;
  currentText: string;
  apply: (translated: string) => void;
}

export interface PendingMediaOperation {
  action: "upload" | "delete";
  filePath: string;
  base64Content?: string;
  sourceFilePath: string;
}

const DEFAULT_MEDIA_UPLOAD_STATE: MediaUploadFieldState = {
  status: "processing",
  progress: 0,
  message: "",
};

function createLocalItemId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createMediaUploadStateKey(
  filePath: string,
  localItemId: string,
  fieldPath: (string | number)[]
): string {
  return `${filePath}::${localItemId}::${JSON.stringify(fieldPath)}`;
}

function toRepositoryUploadPath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/uploads/")) {
    return null;
  }
  return `public${trimmed}`;
}

function toPublicUploadPath(filePath: string): string {
  if (filePath.startsWith("public/")) {
    return `/${filePath.slice("public/".length)}`;
  }
  return filePath.startsWith("/") ? filePath : `/${filePath}`;
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

function buildPublishableContentForFile(
  filePath: string,
  fileItems: DataItem[],
  isArrayFileByPath: Record<string, boolean>
): unknown {
  const sanitizedItems = fileItems.map(stripLocalId);
  const publishableItems =
    isArrayFileByPath[filePath] === false
      ? sanitizedItems
      : sanitizedItems.filter(shouldPersistArrayItem);

  if (isArrayFileByPath[filePath] === false) {
    return publishableItems[0] || {};
  }

  return publishableItems;
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

export {
  LOCAL_ITEM_ID_KEY,
  LANGUAGE_DEPENDENT_FILES,
  IMAGE_UPLOAD_COMPRESSION_OPTIONS,
  PROJECT_GALLERY_VIDEO_MAX_SIZE_BYTES,
  MAX_DEPLOYED_BATCH_REQUEST_BYTES,
  DEFAULT_MEDIA_UPLOAD_STATE,
  createLocalItemId,
  createMediaUploadStateKey,
  toRepositoryUploadPath,
  toPublicUploadPath,
  fetchCMSFile,
  buildAutoId,
  hasAutoIdSource,
  buildPublishableContentForFile,
  isRecord,
  isManagedUploadPath,
  collectManagedUploadPaths,
  countManagedUploadPathReferences,
  findManagedUploadPathByHash,
  resolveImageUploadFolder,
  isProjectGalleryField,
  isProjectGalleryVideoFile,
  normalizeProjectItems,
  ensureLocalizedAdminConfigItem,
  normalizeItems,
  cloneDataItems,
  ensureTranslationsForLanguages,
  autoTranslateLocalizedItems,
  autoTranslateRecordStrings,
  setValueAtPath,
  detectFields,
  isLanguageAwareFile,
};

