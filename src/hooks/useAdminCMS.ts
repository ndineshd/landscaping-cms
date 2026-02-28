/**
 * Hook for managing admin CMS state and operations
 */

"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type {
  APIResponse,
  DataItem,
  DynamicField,
  JSONBatchUpdatePayload,
  MediaUploadFieldState,
} from "@/types/cms";
import { CMS_FILES, generateId } from "@/lib/cms-utils";
import {
  calculateFileHash,
  compressImage,
  fileToBase64,
  formatFileSize,
  generateDeterministicImageFileName,
} from "@/lib/image-compression";
import {
  applyLanguageConfigToAdminConfig,
  ensureLocalizedContentItems,
  extractLanguageConfig,
  type LanguageOption,
  normalizeLanguageCode,
  normalizeLanguageConfig,
  DEFAULT_LANGUAGE_CODE,
} from "@/lib/language-utils";
import {
  LANGUAGE_DEPENDENT_FILES,
  LOCAL_ITEM_ID_KEY,
  IMAGE_UPLOAD_COMPRESSION_OPTIONS,
  PROJECT_GALLERY_VIDEO_MAX_SIZE_BYTES,
  MAX_DEPLOYED_BATCH_REQUEST_BYTES,
  DEFAULT_MEDIA_UPLOAD_STATE,
  type PendingMediaOperation,
  type SaveAllResult,
  autoTranslateLocalizedItems,
  autoTranslateRecordStrings,
  buildAutoId,
  buildPublishableContentForFile,
  cloneDataItems,
  collectManagedUploadPaths,
  countManagedUploadPathReferences,
  createLocalItemId,
  createMediaUploadStateKey,
  detectFields,
  ensureLocalizedAdminConfigItem,
  ensureTranslationsForLanguages,
  fetchCMSFile,
  findManagedUploadPathByHash,
  hasAutoIdSource,
  isLanguageAwareFile,
  isManagedUploadPath,
  isProjectGalleryField,
  isProjectGalleryVideoFile,
  isRecord,
  normalizeItems,
  normalizeProjectItems,
  resolveImageUploadFolder,
  setValueAtPath,
  toPublicUploadPath,
  toRepositoryUploadPath,
} from "@/hooks/useAdminCMS.helpers";

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
  const [pendingMediaOperations, setPendingMediaOperations] = useState<
    PendingMediaOperation[]
  >([]);
  const [mediaUploadStateByField, setMediaUploadStateByField] = useState<
    Record<string, MediaUploadFieldState>
  >({});
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

  const setMediaUploadState = useCallback(
    (
      filePath: string,
      localItemId: string,
      fieldPath: (string | number)[],
      state:
        | MediaUploadFieldState
        | ((previous: MediaUploadFieldState) => MediaUploadFieldState)
    ) => {
      const key = createMediaUploadStateKey(filePath, localItemId, fieldPath);
      setMediaUploadStateByField((prev) => {
        const previousState = prev[key] || DEFAULT_MEDIA_UPLOAD_STATE;
        const nextState =
          typeof state === "function" ? state(previousState) : state;
        return {
          ...prev,
          [key]: {
            ...nextState,
            progress: Math.max(0, Math.min(100, nextState.progress)),
          },
        };
      });
    },
    []
  );

  const queueMediaUpload = useCallback(
    (sourceFilePath: string, publicPath: string, base64Content: string) => {
      const repositoryPath = toRepositoryUploadPath(publicPath);
      if (!repositoryPath) return;

      setPendingMediaOperations((prev) => [
        ...prev,
        {
          action: "upload",
          filePath: repositoryPath,
          base64Content,
          sourceFilePath,
        },
      ]);
    },
    []
  );

  const queueMediaDelete = useCallback(
    (sourceFilePath: string, publicPath: string) => {
      const repositoryPath = toRepositoryUploadPath(publicPath);
      if (!repositoryPath) return;

      setPendingMediaOperations((prev) => [
        ...prev,
        {
          action: "delete",
          filePath: repositoryPath,
          sourceFilePath,
        },
      ]);
    },
    []
  );

  const clearPendingMediaForFiles = useCallback((filePaths: string[]) => {
    if (filePaths.length === 0) return;
    const filePathSet = new Set(filePaths);
    setPendingMediaOperations((prev) =>
      prev.filter((operation) => !filePathSet.has(operation.sourceFilePath))
    );
    setMediaUploadStateByField((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([key]) => {
          const separatorIndex = key.indexOf("::");
          const sourceFilePath =
            separatorIndex >= 0 ? key.slice(0, separatorIndex) : "";
          return !filePathSet.has(sourceFilePath);
        })
      )
    );
  }, []);

  const getEffectiveItemsByFile = useCallback((): Record<string, DataItem[]> => {
    if (!selectedFile) return itemsByFile;
    if (itemsByFile[selectedFile]) return itemsByFile;
    return {
      ...itemsByFile,
      [selectedFile]: items,
    };
  }, [items, itemsByFile, selectedFile]);

  const getMediaUploadState = useCallback(
    (
      localItemId: string,
      fieldPath: (string | number)[]
    ): MediaUploadFieldState | null => {
      if (!selectedFile) return null;
      const key = createMediaUploadStateKey(selectedFile, localItemId, fieldPath);
      return mediaUploadStateByField[key] || null;
    },
    [mediaUploadStateByField, selectedFile]
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
          const fallbackItems = itemsByFile[filePath] || resetSnapshotsByFile[filePath];
          if (fallbackItems && fallbackItems.length >= 0) {
            const normalizedFallback =
              filePath === CMS_FILES.PROJECTS
                ? normalizeProjectItems(fallbackItems).items
                : fallbackItems;
            const fallbackFields = detectFields(normalizedFallback);
            setItems(normalizedFallback);
            setFields(fallbackFields);
            setSelectedFile(filePath);
            toast.warning(
              "Loaded cached data for this section because remote fetch failed."
            );
            return true;
          }

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
        clearPendingMediaForFiles([filePath]);

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
      clearPendingMediaForFiles,
      availableLanguageCodes,
      defaultLanguageCode,
      fieldsByFile,
      itemsByFile,
      languageOptions,
      resetSnapshotsByFile,
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
        const publishCandidates = stagedFilePaths
          .map((filePath) => ({
            filePath,
            fileItems: itemsByFile[filePath] || [],
          }));
        const skippedFileCount = 0;

        const publishedFileSet = new Set(
          publishCandidates.map((candidate) => candidate.filePath)
        );
        const relevantMediaOperations = pendingMediaOperations.filter((operation) =>
          publishedFileSet.has(operation.sourceFilePath)
        );
        const mediaUploadMap = new Map<string, string>();
        const mediaDeleteSet = new Set<string>();

        relevantMediaOperations.forEach((operation) => {
          if (operation.action === "upload" && operation.base64Content) {
            mediaUploadMap.set(operation.filePath, operation.base64Content);
            mediaDeleteSet.delete(operation.filePath);
            return;
          }
          if (operation.action === "delete") {
            if (mediaUploadMap.has(operation.filePath)) {
              mediaUploadMap.delete(operation.filePath);
              return;
            }
            mediaDeleteSet.add(operation.filePath);
          }
        });

        const stagedPublishContentByFile: Record<string, unknown> = {};
        publishCandidates.forEach((entry) => {
          stagedPublishContentByFile[entry.filePath] = buildPublishableContentForFile(
            entry.filePath,
            entry.fileItems,
            isArrayFileByPath
          );
        });

        if (mediaDeleteSet.size > 0) {
          const publishContentByFile: Record<string, unknown> = {
            ...stagedPublishContentByFile,
          };
          let canSafelyDeleteMedia = true;

          for (const cmsFilePath of Object.values(CMS_FILES)) {
            if (Object.prototype.hasOwnProperty.call(publishContentByFile, cmsFilePath)) {
              continue;
            }

            const remoteData = await fetchCMSFile(cmsFilePath, password);
            if (!remoteData.success) {
              canSafelyDeleteMedia = false;
              break;
            }
            publishContentByFile[cmsFilePath] = (
              remoteData.data as Record<string, unknown>
            ).content;
          }

          if (!canSafelyDeleteMedia) {
            mediaDeleteSet.clear();
            toast.warning(
              "Skipped media deletions because latest remote content could not be verified safely."
            );
          } else {
            Array.from(mediaDeleteSet).forEach((repositoryPath) => {
              const publicPath = toPublicUploadPath(repositoryPath);
              const referenceCount = Object.values(publishContentByFile).reduce(
                (total: number, content) =>
                  total + countManagedUploadPathReferences(content, publicPath),
                0
              );

              if (referenceCount > 0) {
                mediaDeleteSet.delete(repositoryPath);
              }
            });
          }
        }

        const payload: JSONBatchUpdatePayload = {
          files: publishCandidates.map((entry) => ({
            filePath: entry.filePath,
            content: JSON.stringify(stagedPublishContentByFile[entry.filePath], null, 2),
          })),
          mediaUploads: Array.from(mediaUploadMap.entries()).map(
            ([filePath, base64Content]) => ({
              filePath,
              base64Content,
            })
          ),
          mediaDeletes: Array.from(mediaDeleteSet),
          password,
        };
        const serializedPayload = JSON.stringify(payload);
        const payloadSizeBytes = new Blob([serializedPayload]).size;
        if (payloadSizeBytes > MAX_DEPLOYED_BATCH_REQUEST_BYTES) {
          throw new Error(
            `Publish payload is too large (${formatFileSize(payloadSizeBytes)}). Reduce media size or publish fewer media changes at once.`
          );
        }

        const response = await fetch("/api/update-json-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: serializedPayload,
        });
        const responseText = await response.text();
        let data: APIResponse | null = null;
        if (responseText.trim().length > 0) {
          try {
            data = JSON.parse(responseText) as APIResponse;
          } catch {
            data = null;
          }
        }

        if (!response.ok) {
          if (response.status === 413) {
            throw new Error(
              "Publish request exceeded the deployed API size limit. Reduce video size and publish again."
            );
          }
          if (data && !data.success) {
            throw new Error(data.error || "Failed to publish content");
          }
          throw new Error(
            responseText.trim() || `Publish failed with HTTP ${response.status}`
          );
        }

        if (!data) {
          throw new Error("Invalid publish response from server");
        }
        if (!data.success) {
          throw new Error(data.error || "Failed to publish content");
        }

        const successCount = publishCandidates.length;
        const failedCount = skippedFileCount;
        const uploadedMediaCount = mediaUploadMap.size;
        const deletedMediaCount = mediaDeleteSet.size;
        const publishedFiles = publishCandidates.map((entry) => entry.filePath);
        const publishedSnapshots: Record<string, DataItem[]> = {};

        publishCandidates.forEach((entry) => {
          publishedSnapshots[entry.filePath] = cloneDataItems(entry.fileItems);
          setDirtyFiles((prev) => ({ ...prev, [entry.filePath]: false }));
          setStagedFiles((prev) => ({ ...prev, [entry.filePath]: false }));
        });
        clearPendingMediaForFiles(Array.from(publishedFileSet));

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
          toast.success(
            `Published ${successCount} file(s), ${uploadedMediaCount} upload(s), ${deletedMediaCount} deletion(s) in one commit`
          );
        }

        if (failedCount > 0) {
          toast.error(`Failed to save ${failedCount} file(s)`);
        }

        return {
          successCount,
          failedCount,
          publishedFiles,
          uploadedMediaCount,
          deletedMediaCount,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to save all data";
        toast.error(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [
      clearPendingMediaForFiles,
      isArrayFileByPath,
      itemsByFile,
      pendingMediaOperations,
      stagedFiles,
    ]
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
      if (!restoreAsQueued) {
        clearPendingMediaForFiles([filePath]);
      }

      toast.success(
        restoreAsQueued
          ? "Draft changes reset to last local save."
          : "Draft changes reset."
      );
      return true;
    },
    [clearPendingMediaForFiles, resetSnapshotQueuedByFile, resetSnapshotsByFile, selectedFile]
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
    async (localItemId: string, _password: string) => {
      if (!selectedFile) return;

      const item = items.find((i: DataItem) => i[LOCAL_ITEM_ID_KEY] === localItemId);
      if (!item) return;

      const imagePaths = collectManagedUploadPaths(item);
      if (imagePaths.length > 0) {
        imagePaths.forEach((imagePath) => {
          queueMediaDelete(selectedFile, imagePath);
        });
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
    [items, markFilesDirty, queueMediaDelete, selectedFile]
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
      _password: string,
      previousImagePath?: string
    ) => {
      if (!selectedFile) {
        toast.error("Select a file before uploading an image");
        return;
      }
      const sourceFilePath = selectedFile;

      if (!file) {
        toast.error("Please select a file");
        return;
      }

      setMediaUploadState(sourceFilePath, localItemId, fieldPath, {
        status: "processing",
        progress: 3,
        message: "Preparing media...",
      });

      setIsLoading(true);
      try {
        const allowProjectGalleryVideo = isProjectGalleryField(
          sourceFilePath,
          fieldPath
        );
        const isVideoUpload = allowProjectGalleryVideo && isProjectGalleryVideoFile(file);

        if (isVideoUpload && file.size > PROJECT_GALLERY_VIDEO_MAX_SIZE_BYTES) {
          setMediaUploadState(sourceFilePath, localItemId, fieldPath, {
            status: "error",
            progress: 0,
            message: "Video must be 50MB or less.",
          });
          toast.error("Video size must be 50MB or less");
          return;
        }

        setMediaUploadState(sourceFilePath, localItemId, fieldPath, {
          status: "processing",
          progress: 12,
          message: "Calculating file fingerprint...",
        });
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
              queueMediaDelete(sourceFilePath, previousImagePath);
            }
          }

          setMediaUploadState(sourceFilePath, localItemId, fieldPath, {
            status: "queued",
            progress: 100,
            message: "Media already exists. Linked to current item.",
          });
          toast.success("File already exists. Linked existing path.");
          return;
        }

        let uploadFile = file;
        let compressionRatio = 0;

        if (!isVideoUpload) {
          setMediaUploadState(sourceFilePath, localItemId, fieldPath, {
            status: "processing",
            progress: 28,
            message: "Compressing image...",
          });
          const compressed = await compressImage(
            file,
            IMAGE_UPLOAD_COMPRESSION_OPTIONS
          );
          uploadFile = compressed.file;
          compressionRatio = compressed.ratio;
        }

        const base64Content = await fileToBase64(uploadFile, (percent) => {
          const normalized = Math.max(0, Math.min(100, percent));
          setMediaUploadState(sourceFilePath, localItemId, fieldPath, {
            status: "processing",
            progress: 40 + normalized * 0.5,
            message: "Encoding media...",
          });
        });
        const uploadFolder = resolveImageUploadFolder(sourceFilePath, fieldPath);
        const fileName = generateDeterministicImageFileName(originalFileHash, file.name);
        const folderSegment = uploadFolder ? `/${uploadFolder}` : "";
        const imagePath = `/uploads${folderSegment}/${fileName}`;
        queueMediaUpload(sourceFilePath, imagePath, base64Content);
        updateItemField(localItemId, fieldPath, imagePath);

        if (
          isManagedUploadPath(previousImagePath) &&
          previousImagePath !== imagePath
        ) {
          queueMediaDelete(sourceFilePath, previousImagePath);
        }

        setMediaUploadState(sourceFilePath, localItemId, fieldPath, {
          status: "queued",
          progress: 100,
          message:
            "Media queued. Click Local Save, then Global Save to publish live.",
        });

        if (isVideoUpload) {
          toast.success("Video queued. Save locally, then publish globally.");
        } else {
          toast.success(
            compressionRatio > 0
              ? `Image queued (${compressionRatio.toFixed(1)}% smaller)`
              : "Image added to publish queue"
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
        setMediaUploadState(sourceFilePath, localItemId, fieldPath, {
          status: "error",
          progress: 0,
          message: "Upload failed. Try again.",
        });
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [
      getEffectiveItemsByFile,
      queueMediaDelete,
      queueMediaUpload,
      selectedFile,
      setMediaUploadState,
      updateItemField,
    ]
  );

  const removeImage = useCallback(
    async (
      localItemId: string,
      fieldPath: (string | number)[],
      _password: string,
      currentImagePath?: string
    ) => {
      if (!selectedFile) return;

      if (isManagedUploadPath(currentImagePath)) {
        queueMediaDelete(selectedFile, currentImagePath);
      }

      updateItemField(localItemId, fieldPath, "");
      setMediaUploadState(selectedFile, localItemId, fieldPath, {
        status: "queued",
        progress: 100,
        message:
          "Removal queued. Click Local Save, then Global Save to publish live.",
      });
      toast.success("Image removed");
    },
    [queueMediaDelete, selectedFile, setMediaUploadState, updateItemField]
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
    getMediaUploadState,
    addField,
    removeField,
    setItems,
    setFields,
  };
}
