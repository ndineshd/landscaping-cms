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
  Save,
  Plus,
  Loader,
  Settings,
  Image,
  Briefcase,
  Globe,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { useAdminCMS } from "@/hooks/useAdminCMS";
import { ItemEditorComponent } from "@/components/admin/ItemEditorComponent";
import { CMS_FILES, getFileMetadata } from "@/lib/cms-utils";

/**
 * Icon map
 */
const ICON_MAP: Record<string, typeof Settings> = {
  Settings,
  Image,
  Briefcase,
  Globe,
};

/**
 * File Card
 */
function FileCard({
  filePath,
  selected,
  onClick,
}: {
  filePath: string;
  selected: boolean;
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

  const {
    items,
    fields,
    selectedFile,
    isLoading,
    isCurrentFileArray,
    dirtyFiles,
    loadData,
    saveData,
    saveAllData,
    updateItemField,
    addItem,
    deleteItem,
    uploadImage,
  } = useAdminCMS();

  const selectedMetadata = selectedFile
    ? getFileMetadata(selectedFile)
    : null;
  const dirtyFileCount = Object.values(dirtyFiles).filter(Boolean).length;
  const hasIdField = fields.some((field) => field.name === "id");
  const hasIdSourceField = fields.some((field) =>
    ["title", "name", "category"].includes(field.name)
  );
  const isAutoIdFile =
    hasIdField && hasIdSourceField;

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
    saveData(selectedFile, password);
  };

  const handleSaveAll = () => {
    saveAllData(password);
  };

  const handleDeleteItem = (localItemId: string) => {
    if (window.confirm("Delete item?")) {
      deleteItem(localItemId, password);
    }
  };

  const handleImageUpload = (localItemId: string) => (file: File) => {
    uploadImage(localItemId, file, password);
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

      {/* MAIN */}
      <div className="flex min-h-screen md:pl-64">
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
        <header className="sticky top-0 z-20 bg-white border-b px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="font-semibold text-lg">Dashboard</h1>
            <p className="text-sm text-gray-500">Manage content</p>
          </div>

          {dirtyFileCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700">
                {dirtyFileCount} unsaved
              </span>
              <Button
                onClick={handleSaveAll}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isLoading ? (
                  <Loader className="animate-spin h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save All
              </Button>
            </div>
          )}
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
                      className="text-slate-700"
                    >
                      {isLoading ? (
                        <Loader className="animate-spin h-4 w-4" />
                      ) : (
                        <Loader className="h-4 w-4" />
                      )}
                      Reload
                    </Button>
                    <Button
                      onClick={addItem}
                      disabled={isLoading || !isCurrentFileArray}
                      title={isCurrentFileArray ? undefined : "This file uses a single object structure"}
                      className="inline-flex items-center gap-2 rounded-[6px] text-center"
                    >
                      <Plus className="h-4 w-4" />
                      Add Item
                    </Button>
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
                      Save Current
                    </Button>
                  </div>
                </div>
                {isAutoIdFile && (
                  <p className="text-xs text-slate-500">
                    IDs are auto-generated globally as lowercase category-title (or title/name).
                  </p>
                )}
              </div>

              <div className="p-4 space-y-4 max-h-[calc(100vh-240px)] overflow-y-auto no-scrollbar">
                {items.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50">
                    <p className="text-sm text-slate-600 mb-4">
                      No records found for this file yet.
                    </p>
                    <Button
                      onClick={addItem}
                      disabled={isLoading || !isCurrentFileArray}
                      title={
                        isCurrentFileArray
                          ? undefined
                          : "This file uses a single object structure"
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Create First Item
                    </Button>
                  </div>
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
                        onFieldChange={(f, v) =>
                          updateItemField(localItemId, f, v)
                        }
                        onImageUpload={handleImageUpload(localItemId)}
                        onDelete={() => handleDeleteItem(localItemId)}
                      />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </main>
        </div>
      </div>
    </div>
  );
}
