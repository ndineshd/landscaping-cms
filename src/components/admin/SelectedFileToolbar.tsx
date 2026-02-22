"use client";

import { Loader, Plus, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelectedFileToolbarProps {
  title: string;
  description: string;
  itemCount: number;
  isLoading: boolean;
  canAddTopLevelItems: boolean;
  selectedFileHasDraftChanges: boolean;
  selectedFileIsQueued: boolean;
  selectedFileHasPendingChanges: boolean;
  onReload: () => void;
  onAddItem: () => void;
  onSaveCurrent: () => void;
  onResetCurrent: () => void;
}

export function SelectedFileToolbar({
  title,
  description,
  itemCount,
  isLoading,
  canAddTopLevelItems,
  selectedFileHasDraftChanges,
  selectedFileIsQueued,
  selectedFileHasPendingChanges,
  onReload,
  onAddItem,
  onSaveCurrent,
  onResetCurrent,
}: SelectedFileToolbarProps) {
  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur p-4 border-b space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {title} ({itemCount})
          </h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={onReload}
            disabled={isLoading}
            className="rounded-[5px] text-slate-700"
          >
            {isLoading ? <Loader className="animate-spin h-4 w-4" /> : <Loader className="h-4 w-4" />}
            Reload
          </Button>
          <Button
            variant="outline"
            onClick={onResetCurrent}
            disabled={isLoading || !selectedFileHasPendingChanges}
            className="rounded-[5px] text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Local Changes
          </Button>
          {canAddTopLevelItems && (
            <Button
              onClick={onAddItem}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-[6px] text-center"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          )}
          {selectedFileHasDraftChanges && (
            <Button
              onClick={onSaveCurrent}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-[6px] text-center bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? <Loader className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
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
  );
}
