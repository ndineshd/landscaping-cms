/**
 * Admin Dashboard Page
 * Modern SaaS UI version (No logic changes)
 */

"use client";

import { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Menu,
  Save,
  Plus,
  Loader,
  Settings,
  Image,
  Briefcase,
  Globe,
  LogOut,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CircleDot,
  CloudUpload,
  Languages,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useAdminCMS } from "@/hooks/useAdminCMS";
import { ItemEditorComponent } from "@/components/admin/ItemEditorComponent";
import { CMS_FILES, getFileLabel, getFileMetadata } from "@/lib/cms-utils";

/**
 * Icon map
 */
const ICON_MAP: Record<string, typeof Settings> = {
  Settings,
  Image,
  Briefcase,
  Globe,
};

const SITE_CONFIG_SECTION_ORDER = [
  { key: "site", label: "Site Settings" },
  { key: "seo", label: "SEO Settings" },
  { key: "about", label: "About Us" },
  { key: "contact", label: "Contact Details" },
  { key: "hero", label: "Hero Section" },
  { key: "theme", label: "Theme Settings" },
  { key: "socialMedia", label: "Other Settings" },
] as const;

interface PublishSummary {
  successCount: number;
  failedCount: number;
  publishedFiles: string[];
}

/**
 * File Card
 */
function FileCard({
  filePath,
  selected,
  hasDraftChanges,
  isQueued,
  onClick,
}: {
  filePath: string;
  selected: boolean;
  hasDraftChanges?: boolean;
  isQueued?: boolean;
  onClick: () => void;
}) {
  const metadata = getFileMetadata(filePath);
  if (!metadata) return null;

  const IconComponent =
    ICON_MAP[metadata.icon as keyof typeof ICON_MAP];

  return (
    <button
      onClick={onClick}
      className={`text-left p-6 rounded-xl border transition-all ${
        selected
          ? "border-blue-500 bg-blue-50 shadow-lg"
          : "border-gray-200 bg-white hover:shadow-lg"
      }`}
    >
      <div className="flex justify-between mb-3">
        <div
          className={`p-2 rounded-lg ${
            selected ? "bg-blue-100" : "bg-gray-100"
          }`}
        >
          <IconComponent
            className={`h-6 w-6 ${
              selected ? "text-blue-600" : "text-gray-600"
            }`}
          />
        </div>
        {selected && (
          <ChevronRight className="h-5 w-5 text-blue-600" />
        )}
      </div>

      <h3 className="font-semibold text-gray-900">
        {metadata.label}
      </h3>
      <p className="text-sm text-gray-600 mt-1">
        {metadata.description}
      </p>
      {(hasDraftChanges || isQueued) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {hasDraftChanges && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
              <CircleDot className="h-3 w-3" />
              Draft
            </span>
          )}
          {isQueued && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              Queued
            </span>
          )}
        </div>
      )}

      <code className="text-xs mt-3 block text-gray-400 font-mono">
        {filePath}
      </code>
    </button>
  );
}

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
  const selectedFileHasDraftChanges = selectedFile
    ? Boolean(dirtyFiles[selectedFile] && !stagedFiles[selectedFile])
    : false;
  const selectedFileIsQueued = selectedFile
    ? Boolean(dirtyFiles[selectedFile] && stagedFiles[selectedFile])
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

    const defaultFile = CMS_FILES.ADMIN_CONFIG;

    // If already loaded, do nothing
    if (selectedFile === defaultFile) return;

    // Set selection input and load automatically
    setSelectFileInput(defaultFile);
    if (password) {
      loadData(defaultFile, password);
    }
  }, [isAuthenticated]);

  const handleSelectFile = (filePath: string) => {
    setSelectFileInput(filePath);
    setIsMobileSidebarOpen(false);
    // If authenticated and password provided, load immediately
    if (isAuthenticated && password) {
      loadData(filePath, password);
    }
  };

  const handleAuthenticate = () => {
    if (password) setIsAuthenticated(true);
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
      const nextActiveCodes = availableLanguageCodes.includes(code)
        ? availableLanguageCodes
        : [...availableLanguageCodes, code];
      updateLanguageConfig(languageOptions, nextActiveCodes, defaultLanguageCode);
    } else {
      updateLanguageConfig(
        [...languageOptions, { code, name: name || code.toUpperCase() }],
        [...availableLanguageCodes, code],
        defaultLanguageCode
      );
    }

    setNewLanguageCode("");
    setNewLanguageName("");
  };

  const handleToggleActiveLanguage = (languageCode: string) => {
    const nextActiveCodes = availableLanguageCodes.includes(languageCode)
      ? availableLanguageCodes.filter((code) => code !== languageCode)
      : [...availableLanguageCodes, languageCode];
    updateLanguageConfig(languageOptions, nextActiveCodes, defaultLanguageCode);
  };

  const handleDefaultLanguageChange = (languageCode: string) => {
    updateLanguageConfig(languageOptions, availableLanguageCodes, languageCode);
  };

  const handleRemoveLanguage = (languageCode: string) => {
    if (languageCode === "en") return;
    const nextLanguages = languageOptions.filter((language) => language.code !== languageCode);
    const nextActiveCodes = availableLanguageCodes.filter((code) => code !== languageCode);
    const nextDefault =
      languageCode === defaultLanguageCode
        ? nextActiveCodes[0] || nextLanguages[0]?.code || defaultLanguageCode
        : defaultLanguageCode;

    updateLanguageConfig(nextLanguages, nextActiveCodes, nextDefault);
  };

  /**
   * LOGIN PAGE
   */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-500 p-6">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
          <div className="text-center">
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold">
              CMS Admin Panel
            </h1>
            <p className="text-gray-500 text-sm">
              Enter your password
            </p>
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Password"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-500"
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>

          <button
            onClick={handleAuthenticate}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  /**
   * DASHBOARD
   */
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* SIDEBAR */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r flex-col z-30">
        <div className="p-4 border-b font-semibold text-base">
          CMS Admin
        </div>

        <div className="flex-1 p-4 space-y-2 overflow-auto no-scrollbar">
          {Object.values(CMS_FILES).map((filePath) => {
            const metadata = getFileMetadata(filePath);
            if (!metadata) return null;

            const Icon =
              ICON_MAP[metadata.icon as keyof typeof ICON_MAP];

            return (
              <button
                key={filePath}
                onClick={() => handleSelectFile(filePath)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${
                  (selectFileInput === filePath || selectedFile === filePath)
                    ? "bg-blue-50 text-blue-600"
                    : "hover:bg-gray-100"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{metadata.label}</span>
                {dirtyFiles[filePath] && !stagedFiles[filePath] && (
                  <span className="ml-auto inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                )}
                {dirtyFiles[filePath] && stagedFiles[filePath] && (
                  <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 bg-red-100 text-red-600 rounded-lg"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* MOBILE SIDEBAR DRAWER */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close sidebar"
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white border-r flex flex-col shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-semibold text-base">CMS Admin</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="h-8 w-8"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 p-4 space-y-2 overflow-auto no-scrollbar">
              {Object.values(CMS_FILES).map((filePath) => {
                const metadata = getFileMetadata(filePath);
                if (!metadata) return null;

                const Icon =
                  ICON_MAP[metadata.icon as keyof typeof ICON_MAP];

                return (
                  <button
                    key={filePath}
                    onClick={() => handleSelectFile(filePath)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${
                      (selectFileInput === filePath || selectedFile === filePath)
                        ? "bg-blue-50 text-blue-600"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{metadata.label}</span>
                    {dirtyFiles[filePath] && !stagedFiles[filePath] && (
                      <span className="ml-auto inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                    )}
                    {dirtyFiles[filePath] && stagedFiles[filePath] && (
                      <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 bg-red-100 text-red-600 rounded-lg"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN */}
      <div className="flex min-h-screen md:pl-64">
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
        <header className="sticky top-0 z-20 bg-white border-b px-4 py-3 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="w-full flex items-start justify-between md:w-auto">
            <div>
              <h1 className="font-semibold text-lg">Dashboard</h1>
              <p className="text-sm text-gray-500">Manage content</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 md:hidden"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-full flex flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              onClick={handleSaveAll}
              disabled={isLoading || stagedFileCount === 0}
              className="order-1 w-full rounded-[5px] bg-indigo-600 hover:bg-indigo-700 sm:order-4 sm:w-auto"
            >
              {isLoading ? (
                <Loader className="animate-spin h-4 w-4" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              Global Save Changes ({stagedFileCount})
            </Button>

            <div className="order-2 flex items-center justify-between gap-2 border rounded-lg px-2 py-1 sm:order-1 sm:justify-start">
              <span className="text-xs text-slate-500">Language</span>
              <select
                value={activeLanguageCode}
                onChange={(e) => setActiveLanguageCode(e.target.value)}
                className="text-sm bg-transparent outline-none"
              >
                {editableLanguageCodes.map((languageCode) => (
                  <option key={languageCode} value={languageCode}>
                    {getLanguageName(languageCode)}
                  </option>
                ))}
              </select>
            </div>

            {(draftFileCount > 0 || stagedFileCount > 0) && (
              <div className="order-3 flex items-center gap-2 sm:order-2">
                {draftFileCount > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700">
                    {draftFileCount} draft
                  </span>
                )}
                {stagedFileCount > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                    {stagedFileCount} queued
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
          {/* FILE GRID (mobile only) */}
          {!selectedFile && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:hidden">
              {Object.values(CMS_FILES).map((filePath) => (
                <FileCard
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
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur p-4 border-b space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {selectedMetadata?.label || "Data"} ({items.length})
                    </h2>
                    <p className="text-sm text-slate-500">
                      {selectedMetadata?.description || "Update and save your content changes"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={handleReload}
                      disabled={isLoading}
                      className="rounded-[5px] text-slate-700"
                    >
                      {isLoading ? (
                        <Loader className="animate-spin h-4 w-4" />
                      ) : (
                        <Loader className="h-4 w-4" />
                      )}
                      Reload
                    </Button>
                    {canAddTopLevelItems && (
                      <Button
                        onClick={addItem}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-[6px] text-center"
                      >
                        <Plus className="h-4 w-4" />
                        Add Item
                      </Button>
                    )}
                    {selectedFileHasDraftChanges && (
                      <Button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-[6px] text-center bg-emerald-600 hover:bg-emerald-700"
                      >
                        {isLoading ? (
                          <Loader className="animate-spin h-4 w-4" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save Current Locally
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {selectedFileHasDraftChanges && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                      Draft changes pending local save
                    </span>
                  )}
                  {selectedFileIsQueued && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
                      Local save complete. Ready for global update
                    </span>
                  )}
                </div>
              </div>

              {isSiteConfigFile && (
                <div className="p-4 border-b bg-slate-50/70">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                            <Languages className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              Language Settings
                            </h3>
                            <p className="text-xs text-slate-500">
                              Add, remove, and activate site languages.
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setIsLanguageSettingsExpanded((prevValue) => !prevValue)
                          }
                          className="h-8 px-2 text-xs"
                        >
                          {isLanguageSettingsExpanded ? "Collapse" : "Expand"}
                          {isLanguageSettingsExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>

                      {isLanguageSettingsExpanded && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-slate-600">
                                Default Language
                              </label>
                              <select
                                value={defaultLanguageCode}
                                onChange={(e) => handleDefaultLanguageChange(e.target.value)}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              >
                                {languageOptions.map((language) => (
                                  <option key={language.code} value={language.code}>
                                    {language.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-medium text-slate-600">
                                Active Language Selector
                              </label>
                              <select
                                value={activeLanguageCode}
                                onChange={(e) => setActiveLanguageCode(e.target.value)}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              >
                                {editableLanguageCodes.map((languageCode) => (
                                  <option key={languageCode} value={languageCode}>
                                    {getLanguageName(languageCode)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                            {languageOptions.map((language) => {
                              const canRemove =
                                language.code !== defaultLanguageCode &&
                                language.code !== "en";
                              return (
                                <div
                                  key={language.code}
                                  className="flex items-center justify-between gap-2 rounded-md bg-white border border-slate-200 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-slate-800">
                                      {language.name}
                                    </div>
                                    <div className="text-xs text-slate-500 uppercase">
                                      {language.code}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                                      <input
                                        type="checkbox"
                                        checked={availableLanguageCodes.includes(language.code)}
                                        onChange={() => handleToggleActiveLanguage(language.code)}
                                      />
                                      Active
                                    </label>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRemoveLanguage(language.code)}
                                      disabled={!canRemove}
                                      className="text-red-600 border-red-200 hover:bg-red-50"
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-[1fr,140px,120px] gap-3 items-end">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-slate-600">
                                Language Name
                              </label>
                              <input
                                type="text"
                                value={newLanguageName}
                                onChange={(e) => setNewLanguageName(e.target.value)}
                                placeholder="Telugu"
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-slate-600">
                                Language Code
                              </label>
                              <input
                                type="text"
                                value={newLanguageCode}
                                onChange={(e) => setNewLanguageCode(e.target.value)}
                                placeholder="tel"
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm lowercase"
                              />
                            </div>
                            <Button
                              onClick={handleAddLanguage}
                              disabled={!newLanguageCode.trim()}
                              className="h-10"
                            >
                              Add Language
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 space-y-4 max-h-[calc(100vh-240px)] overflow-y-auto no-scrollbar">
                {items.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50">
                    <p className="text-sm text-slate-600 mb-4">
                      No records found for this file yet.
                    </p>
                    {canAddTopLevelItems && (
                      <Button
                        onClick={addItem}
                        disabled={isLoading}
                      >
                        <Plus className="h-4 w-4" />
                        Create First Item
                      </Button>
                    )}
                  </div>
                ) : (
                  isSiteConfigFile && siteConfigItem && siteConfigLocalId ? (
                    siteConfigSections.map((section) => (
                      <div
                        key={`${siteConfigLocalId}-${section.key}`}
                        className="border p-3 rounded-md bg-gray-50"
                      >
                        <ItemEditorComponent
                          item={siteConfigItem}
                          fields={fields}
                          password={password}
                          disabled={isLoading}
                          autoIdFromContent={false}
                          activeLanguageCode={activeLanguageCode}
                          defaultLanguageCode={defaultLanguageCode}
                          availableLanguageCodes={allLanguageCodes}
                          enableLanguageEditing={isLanguageEditableFile}
                          languageEditableRootPaths={["hero", "about"]}
                          hiddenFieldPaths={siteConfigHiddenFieldPaths}
                          filterFieldNames={[section.key]}
                          titleOverride={section.label}
                          hideDeleteAction
                          defaultExpanded={false}
                          onFieldChange={(f, v) =>
                            updateItemField(siteConfigLocalId, f, v)
                          }
                          onImageUpload={(fieldPath, file, currentValue) =>
                            handleImageUpload(siteConfigLocalId, fieldPath, currentValue)(file)
                          }
                          onImageRemove={(fieldPath, currentValue) =>
                            handleImageRemove(siteConfigLocalId, fieldPath, currentValue)
                          }
                          onDelete={() => {}}
                        />
                      </div>
                    ))
                  ) : (
                    items.map((item) => {
                      const localItemId =
                        (item.__localId as string) || String(item.id);

                      return (
                        <div key={localItemId} className="border p-3 rounded-md bg-gray-50">
                          <ItemEditorComponent
                            item={item}
                            fields={fields}
                            password={password}
                            disabled={isLoading}
                            autoIdFromContent={isAutoIdFile}
                            activeLanguageCode={activeLanguageCode}
                            defaultLanguageCode={defaultLanguageCode}
                            availableLanguageCodes={allLanguageCodes}
                            enableLanguageEditing={isLanguageEditableFile}
                            onFieldChange={(f, v) =>
                              updateItemField(localItemId, f, v)
                            }
                            onImageUpload={(fieldPath, file, currentValue) =>
                              handleImageUpload(localItemId, fieldPath, currentValue)(file)
                            }
                            onImageRemove={(fieldPath, currentValue) =>
                              handleImageRemove(localItemId, fieldPath, currentValue)
                            }
                            onDelete={() => handleDeleteItem(localItemId)}
                          />
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          )}
        </main>
        </div>
      </div>
      <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <DialogContent className="border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              Successfully Updated
            </DialogTitle>
            <DialogDescription>
              Your queued CMS changes are published. It can take a few minutes for updates to appear on the live site.
            </DialogDescription>
          </DialogHeader>
          {publishSummary && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
              <p className="font-medium text-slate-800">
                {publishSummary.successCount} file(s) updated
              </p>
              {publishSummary.failedCount > 0 && (
                <p className="text-red-600">
                  {publishSummary.failedCount} file(s) failed to update
                </p>
              )}
              {publishSummary.publishedFiles.length > 0 && (
                <p className="text-slate-600">
                  {publishSummary.publishedFiles.map((filePath) => getFileLabel(filePath)).join(", ")}
                </p>
              )}
            </div>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
