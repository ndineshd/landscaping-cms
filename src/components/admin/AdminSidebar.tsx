"use client";

import { LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminFileNavList } from "@/components/admin/AdminFileNavigation";

interface AdminSidebarProps {
  selectFileInput: string;
  selectedFile: string | null;
  dirtyFiles: Record<string, boolean>;
  stagedFiles: Record<string, boolean>;
  onSelectFile: (filePath: string) => void;
  onLogout: () => void;
  isMobileSidebarOpen: boolean;
  onCloseMobileSidebar: () => void;
}

export function AdminSidebar({
  selectFileInput,
  selectedFile,
  dirtyFiles,
  stagedFiles,
  onSelectFile,
  onLogout,
  isMobileSidebarOpen,
  onCloseMobileSidebar,
}: AdminSidebarProps) {
  return (
    <>
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r flex-col z-30">
        <div className="p-4 border-b font-semibold text-base">CMS Admin</div>

        <div className="flex-1 p-4 space-y-2 overflow-auto no-scrollbar">
          <AdminFileNavList
            selectFileInput={selectFileInput}
            selectedFile={selectedFile}
            dirtyFiles={dirtyFiles}
            stagedFiles={stagedFiles}
            onSelectFile={onSelectFile}
          />
        </div>

        <div className="p-4 border-t">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 bg-red-100 text-red-600 rounded-lg"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close sidebar"
            className="absolute inset-0 bg-black/30"
            onClick={onCloseMobileSidebar}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white border-r flex flex-col shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-semibold text-base">CMS Admin</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onCloseMobileSidebar}
                className="h-8 w-8"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 p-4 space-y-2 overflow-auto no-scrollbar">
              <AdminFileNavList
                selectFileInput={selectFileInput}
                selectedFile={selectedFile}
                dirtyFiles={dirtyFiles}
                stagedFiles={stagedFiles}
                onSelectFile={onSelectFile}
              />
            </div>

            <div className="p-4 border-t">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2 bg-red-100 text-red-600 rounded-lg"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
