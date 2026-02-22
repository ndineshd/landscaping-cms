/**
 * Admin Dashboard Page
 * Modern SaaS UI version (No logic changes)
 */

"use client";

import { useState, useEffect } from "react";
import { useAdminCMS } from "@/hooks/useAdminCMS";
import { AdminFileCard } from "@/components/admin/AdminFileNavigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminItemEditorList } from "@/components/admin/AdminItemEditorList";
import { AdminLoginCard } from "@/components/admin/AdminLoginCard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { LanguageSettingsCard } from "@/components/admin/LanguageSettingsCard";
import { PublishSummaryDialog, type PublishSummary } from "@/components/admin/PublishSummaryDialog";
import { SelectedFileToolbar } from "@/components/admin/SelectedFileToolbar";
import { CMS_FILES, getFileLabel, getFileMetadata } from "@/lib/cms-utils";

const SITE_CONFIG_SECTION_ORDER = [
  { key: "site", label: "Site Settings" },
  { key: "seo", label: "SEO Settings" },
  { key: "about", label: "About Us" },
  { key: "contact", label: "Contact Details" },
  { key: "hero", label: "Hero Section" },
  { key: "theme", label: "Theme Settings" },
  { key: "socialMedia", label: "Other Settings" },
] as const;

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectFileInput, setSelectFileInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [newLanguageName, setNewLanguageName] = useState("");
  const [newLanguageCode, setNewLanguageCode] = useState("");
  const [isLanguageSettingsExpanded, setIsLanguageSettingsExpanded] = useState(false);
  const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(null);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const {
    items,
    fields,
    selectedFile,
    isLoading,
    isCurrentFileArray,
    dirtyFiles,
    stagedFiles,
    loadData,
    saveData,
    saveAllData,
    resetDraftChanges,
    languageOptions,
    defaultLanguageCode,
    activeLanguageCode,
    availableLanguageCodes,
    setActiveLanguageCode,
    updateLanguageConfig,
    updateItemField,
    addItem,
    deleteItem,
    uploadImage,
    removeImage,
  } = useAdminCMS();

  const selectedMetadata = selectedFile
    ? getFileMetadata(selectedFile)
    : null;
  const stagedFileCount = Object.entries(stagedFiles).filter(
    ([filePath, isStaged]) => isStaged && dirtyFiles[filePath]
  ).length;
  const draftFileCount = Object.entries(dirtyFiles).filter(
    ([filePath, isDirty]) => isDirty && !stagedFiles[filePath]
  ).length;
  const pendingFileCount = stagedFileCount + draftFileCount;
  const selectedFileHasDraftChanges = selectedFile
    ? Boolean(dirtyFiles[selectedFile] && !stagedFiles[selectedFile])
    : false;
  const selectedFileIsQueued = selectedFile
    ? Boolean(dirtyFiles[selectedFile] && stagedFiles[selectedFile])
    : false;
  const selectedFileHasPendingChanges = selectedFile
    ? Boolean(dirtyFiles[selectedFile] || stagedFiles[selectedFile])
    : false;
  const hasIdField = fields.some((field) => field.name === "id");
  const hasIdSourceField = fields.some((field) =>
    ["title", "name", "category"].includes(field.name)
  );
  const isAutoIdFile =
    hasIdField && hasIdSourceField;
  const allLanguageCodes = languageOptions.map((language) => language.code);
  const editableLanguageCodes =
    availableLanguageCodes.length > 0
      ? availableLanguageCodes
      : [defaultLanguageCode];
  const isLanguageEditableFile =
    selectedFile === CMS_FILES.PROJECTS ||
    selectedFile === CMS_FILES.SERVICES ||
    selectedFile === CMS_FILES.ADMIN_CONFIG;
  const isSiteConfigFile = selectedFile === CMS_FILES.ADMIN_CONFIG;
  const hideAddItemButton =
    selectedFile === CMS_FILES.ADMIN_CONFIG || selectedFile === CMS_FILES.TRANSLATIONS;
  const canAddTopLevelItems = isCurrentFileArray && !hideAddItemButton;
  const siteConfigItem = isSiteConfigFile ? items[0] : null;
  const siteConfigLocalId =
    siteConfigItem &&
    (typeof siteConfigItem.__localId === "string"
      ? (siteConfigItem.__localId as string)
      : String(siteConfigItem.id ?? ""));
  const siteConfigHiddenFieldPaths = [
    "site.defaultLanguage",
    "site.languages",
    "site.availableLanguages",
    "contact.phone",
    "contact.email",
    "contact.address",
    "contact.location",
  ];
  const knownSiteConfigSectionKeys = new Set<string>(
    SITE_CONFIG_SECTION_ORDER.map((section) => section.key)
  );
  const siteConfigSections = [
    ...SITE_CONFIG_SECTION_ORDER.filter((section) =>
      fields.some((field) => field.name === section.key)
    ),
    ...fields
      .filter((field) => !knownSiteConfigSectionKeys.has(field.name))
      .map((field) => ({
        key: field.name,
        label: field.label || field.name,
      })),
  ].filter((section, index, array) =>
    index === array.findIndex((candidate) => candidate.key === section.key)
  );

  const getLanguageName = (languageCode: string) =>
    languageOptions.find((language) => language.code === languageCode)?.name ||
    languageCode.toUpperCase();

  // When user authenticates, auto-select and load the default site configuration
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!password) return;

    const defaultFile = CMS_FILES.ADMIN_CONFIG;

    // If already loaded, do nothing
    if (selectedFile === defaultFile) return;

    // Set selection input and load automatically
    setSelectFileInput(defaultFile);
    void loadData(defaultFile, password);
  }, [isAuthenticated, loadData, password, selectedFile]);

  const handleSelectFile = (filePath: string) => {
    setSelectFileInput(filePath);
    setIsMobileSidebarOpen(false);
    // If authenticated and password provided, load immediately
    if (isAuthenticated && password) {
      loadData(filePath, password);
    }
  };

  const handleAuthenticate = async () => {
    const trimmedPassword = password.trim();
    if (!trimmedPassword) return;

    if (trimmedPassword !== password) {
      setPassword(trimmedPassword);
    }

    const defaultFile = CMS_FILES.ADMIN_CONFIG;
    setSelectFileInput(defaultFile);
    const isAuthenticatedUser = await loadData(defaultFile, trimmedPassword, true);
    setIsAuthenticated(isAuthenticatedUser);
    if (!isAuthenticatedUser) {
      setSelectFileInput("");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    setSelectFileInput("");
    setIsMobileSidebarOpen(false);
  };

  const handleLoad = () => {
    if (!selectFileInput) return;
    loadData(selectFileInput, password);
  };

  const handleReload = () => {
    if (!selectedFile) return;
    loadData(selectedFile, password, true);
  };

  const handleSave = () => {
    if (!selectedFile) return;
    saveData(selectedFile);
  };

  const handleSaveAll = async () => {
    const result = await saveAllData(password);
    if (!result || result.successCount === 0) return;

    setPublishSummary(result);
    setIsPublishDialogOpen(true);
  };

  const handleResetCurrent = async () => {
    if (!selectedFile) return;
    if (!selectedFileHasPendingChanges) return;

    const shouldReset = window.confirm(
      selectedFileHasDraftChanges
        ? "Reset draft changes for this file? This will revert to the last local-saved state (if available), otherwise to the last loaded state."
        : "Reset local changes for this file and reload from remote?"
    );
    if (!shouldReset) return;

    if (selectedFileHasDraftChanges) {
      const didReset = resetDraftChanges(selectedFile);
      if (didReset) return;
    }

    await loadData(selectedFile, password, true);
  };

  const handleResetAll = async () => {
    const filePathsToReset = Array.from(
      new Set([...Object.keys(dirtyFiles), ...Object.keys(stagedFiles)])
    ).filter((filePath) => dirtyFiles[filePath] || stagedFiles[filePath]);
    if (filePathsToReset.length === 0) return;

    const shouldReset = window.confirm(
      `Reset all local changes for ${filePathsToReset.length} file(s)? This will discard local drafts and queued updates.`
    );
    if (!shouldReset) return;

    const orderedFilePaths = [...filePathsToReset].sort((left, right) => {
      if (left === CMS_FILES.ADMIN_CONFIG) return -1;
      if (right === CMS_FILES.ADMIN_CONFIG) return 1;
      return 0;
    });

    const previousSelection = selectedFile;
    let lastLoadedPath: string | null = null;
    for (const filePath of orderedFilePaths) {
      await loadData(filePath, password, true);
      lastLoadedPath = filePath;
    }

    if (previousSelection && lastLoadedPath && previousSelection !== lastLoadedPath) {
      await loadData(previousSelection, password);
    }
  };

  const handleDeleteItem = (localItemId: string) => {
    if (window.confirm("Delete item?")) {
      deleteItem(localItemId, password);
    }
  };

  const handleImageUpload =
    (localItemId: string, fieldPath: (string | number)[], currentValue?: string) =>
    (file: File) => {
      uploadImage(localItemId, fieldPath, file, password, currentValue);
    };

  const handleImageRemove = (
    localItemId: string,
    fieldPath: (string | number)[],
    currentValue?: string
  ) => {
    removeImage(localItemId, fieldPath, password, currentValue);
  };

  const handleAddLanguage = () => {
    const code = newLanguageCode.trim().toLowerCase();
    const name = newLanguageName.trim();
    if (!code) return;

    const existing = languageOptions.find((language) => language.code === code);
    if (existing) {
      const nextLanguages = languageOptions.map((language) =>
        language.code === code
          ? { ...language, name: name || language.name }
          : language
      );
      const nextActiveCodes = availableLanguageCodes.includes(code)
        ? availableLanguageCodes
        : [...availableLanguageCodes, code];
      updateLanguageConfig(
        nextLanguages,
        nextActiveCodes,
        defaultLanguageCode,
        password
      );
    } else {
      updateLanguageConfig(
        [...languageOptions, { code, name: name || code.toUpperCase() }],
        [...availableLanguageCodes, code],
        defaultLanguageCode,
        password
      );
    }

    setNewLanguageCode("");
    setNewLanguageName("");
  };

  const handleUpdateLanguageName = (languageCode: string, nextName: string) => {
    const normalizedName = nextName.trim();
    if (!normalizedName) return;

    const currentLanguage = languageOptions.find((language) => language.code === languageCode);
    if (!currentLanguage || currentLanguage.name === normalizedName) return;

    const nextLanguages = languageOptions.map((language) =>
      language.code === languageCode
        ? { ...language, name: normalizedName }
        : language
    );

    updateLanguageConfig(
      nextLanguages,
      availableLanguageCodes,
      defaultLanguageCode,
      password
    );
  };

  const handleToggleActiveLanguage = (languageCode: string) => {
    const nextActiveCodes = availableLanguageCodes.includes(languageCode)
      ? availableLanguageCodes.filter((code) => code !== languageCode)
      : [...availableLanguageCodes, languageCode];
    updateLanguageConfig(
      languageOptions,
      nextActiveCodes,
      defaultLanguageCode,
      password
    );
  };

  const handleDefaultLanguageChange = (languageCode: string) => {
    updateLanguageConfig(
      languageOptions,
      availableLanguageCodes,
      languageCode,
      password
    );
  };

  const handleRemoveLanguage = (languageCode: string) => {
    if (languageCode === "en") return;
    const nextLanguages = languageOptions.filter((language) => language.code !== languageCode);
    const nextActiveCodes = availableLanguageCodes.filter((code) => code !== languageCode);
    const nextDefault =
      languageCode === defaultLanguageCode
        ? nextActiveCodes[0] || nextLanguages[0]?.code || defaultLanguageCode
        : defaultLanguageCode;

    updateLanguageConfig(nextLanguages, nextActiveCodes, nextDefault, password);
  };

  /**
   * LOGIN PAGE
   */
  if (!isAuthenticated) {
    return (
      <AdminLoginCard
        password={password}
        showPassword={showPassword}
        onPasswordChange={setPassword}
        onToggleShowPassword={() => setShowPassword((prevValue) => !prevValue)}
        onAuthenticate={handleAuthenticate}
      />
    );
  }

  /**
   * DASHBOARD
   */
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <AdminSidebar
        selectFileInput={selectFileInput}
        selectedFile={selectedFile}
        dirtyFiles={dirtyFiles}
        stagedFiles={stagedFiles}
        onSelectFile={handleSelectFile}
        onLogout={handleLogout}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
      />

      {/* MAIN */}
      <div className="flex min-h-screen md:pl-64">
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <AdminHeader
            isLoading={isLoading}
            stagedFileCount={stagedFileCount}
            draftFileCount={draftFileCount}
            pendingFileCount={pendingFileCount}
            activeLanguageCode={activeLanguageCode}
            editableLanguageCodes={editableLanguageCodes}
            onActiveLanguageChange={setActiveLanguageCode}
            getLanguageName={getLanguageName}
            onSaveAll={handleSaveAll}
            onResetAll={handleResetAll}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          />

          {/* CONTENT */}
          <main className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
            {/* FILE GRID (mobile only) */}
            {!selectedFile && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:hidden">
                {Object.values(CMS_FILES).map((filePath) => (
                  <AdminFileCard
                    key={filePath}
                    filePath={filePath}
                    selected={selectFileInput === filePath}
                    hasDraftChanges={Boolean(dirtyFiles[filePath] && !stagedFiles[filePath])}
                    isQueued={Boolean(dirtyFiles[filePath] && stagedFiles[filePath])}
                    onClick={() => handleSelectFile(filePath)}
                  />
                ))}
              </div>
            )}

            {/* LOAD */}
            {selectFileInput && !selectedFile && (
              <div className="bg-white p-6 rounded-xl shadow-sm flex justify-between md:hidden">
                <div>
                  <h3 className="font-semibold">Load file?</h3>
                </div>
                <button
                  onClick={handleLoad}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                >
                  Load
                </button>
              </div>
            )}

            {/* ITEMS */}
            {selectedFile && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <SelectedFileToolbar
                  title={selectedMetadata?.label || "Data"}
                  description={selectedMetadata?.description || "Update and save your content changes"}
                  itemCount={items.length}
                  isLoading={isLoading}
                  canAddTopLevelItems={canAddTopLevelItems}
                  selectedFileHasDraftChanges={selectedFileHasDraftChanges}
                  selectedFileIsQueued={selectedFileIsQueued}
                  selectedFileHasPendingChanges={selectedFileHasPendingChanges}
                  onReload={handleReload}
                  onAddItem={addItem}
                  onSaveCurrent={handleSave}
                  onResetCurrent={handleResetCurrent}
                />

                {isSiteConfigFile && (
                  <div className="p-4 border-b bg-slate-50/70">
                    <div className="grid grid-cols-1 gap-4">
                      <LanguageSettingsCard
                        isExpanded={isLanguageSettingsExpanded}
                        onToggleExpanded={() =>
                          setIsLanguageSettingsExpanded((prevValue) => !prevValue)
                        }
                        defaultLanguageCode={defaultLanguageCode}
                        activeLanguageCode={activeLanguageCode}
                        editableLanguageCodes={editableLanguageCodes}
                        availableLanguageCodes={availableLanguageCodes}
                        languageOptions={languageOptions}
                        newLanguageName={newLanguageName}
                        newLanguageCode={newLanguageCode}
                        onNewLanguageNameChange={setNewLanguageName}
                        onNewLanguageCodeChange={setNewLanguageCode}
                        onDefaultLanguageChange={handleDefaultLanguageChange}
                        onActiveLanguageChange={setActiveLanguageCode}
                        onToggleActiveLanguage={handleToggleActiveLanguage}
                        onRemoveLanguage={handleRemoveLanguage}
                        onUpdateLanguageName={handleUpdateLanguageName}
                        onAddLanguage={handleAddLanguage}
                        getLanguageName={getLanguageName}
                      />
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-4 max-h-[calc(100vh-240px)] overflow-y-auto no-scrollbar">
                  <AdminItemEditorList
                    items={items}
                    fields={fields}
                    password={password}
                    isLoading={isLoading}
                    canAddTopLevelItems={canAddTopLevelItems}
                    isSiteConfigFile={isSiteConfigFile}
                    siteConfigItem={siteConfigItem}
                    siteConfigLocalId={siteConfigLocalId || null}
                    siteConfigSections={siteConfigSections}
                    siteConfigHiddenFieldPaths={siteConfigHiddenFieldPaths}
                    isAutoIdFile={isAutoIdFile}
                    activeLanguageCode={activeLanguageCode}
                    defaultLanguageCode={defaultLanguageCode}
                    allLanguageCodes={allLanguageCodes}
                    isLanguageEditableFile={isLanguageEditableFile}
                    allowProjectGalleryVideo={selectedFile === CMS_FILES.PROJECTS}
                    onAddItem={addItem}
                    onUpdateItemField={updateItemField}
                    onImageUpload={(localItemId, fieldPath, file, currentValue) =>
                      handleImageUpload(localItemId, fieldPath, currentValue)(file)
                    }
                    onImageRemove={handleImageRemove}
                    onDeleteItem={handleDeleteItem}
                  />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
      <PublishSummaryDialog
        open={isPublishDialogOpen}
        onOpenChange={setIsPublishDialogOpen}
        publishSummary={publishSummary}
        getFileLabel={getFileLabel}
      />
    </div>
  );
}
