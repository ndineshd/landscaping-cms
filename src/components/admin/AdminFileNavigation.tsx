"use client";

import { Briefcase, CheckCircle2, ChevronRight, CircleDot, Globe, Image, Settings } from "lucide-react";
import { CMS_FILES, getFileMetadata } from "@/lib/cms-utils";

const ICON_MAP: Record<string, typeof Settings> = {
  Settings,
  Image,
  Briefcase,
  Globe,
};

interface FileStateProps {
  selectFileInput: string;
  selectedFile: string | null;
  dirtyFiles: Record<string, boolean>;
  stagedFiles: Record<string, boolean>;
  onSelectFile: (filePath: string) => void;
}

export function AdminFileNavList({
  selectFileInput,
  selectedFile,
  dirtyFiles,
  stagedFiles,
  onSelectFile,
}: FileStateProps) {
  return (
    <>
      {Object.values(CMS_FILES).map((filePath) => {
        const metadata = getFileMetadata(filePath);
        if (!metadata) return null;

        const Icon = ICON_MAP[metadata.icon as keyof typeof ICON_MAP];

        return (
          <button
            key={filePath}
            onClick={() => onSelectFile(filePath)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${
              selectFileInput === filePath || selectedFile === filePath
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
    </>
  );
}

interface AdminFileCardProps {
  filePath: string;
  selected: boolean;
  hasDraftChanges?: boolean;
  isQueued?: boolean;
  onClick: () => void;
}

export function AdminFileCard({
  filePath,
  selected,
  hasDraftChanges,
  isQueued,
  onClick,
}: AdminFileCardProps) {
  const metadata = getFileMetadata(filePath);
  if (!metadata) return null;

  const IconComponent = ICON_MAP[metadata.icon as keyof typeof ICON_MAP];

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
        <div className={`p-2 rounded-lg ${selected ? "bg-blue-100" : "bg-gray-100"}`}>
          <IconComponent className={`h-6 w-6 ${selected ? "text-blue-600" : "text-gray-600"}`} />
        </div>
        {selected && <ChevronRight className="h-5 w-5 text-blue-600" />}
      </div>

      <h3 className="font-semibold text-gray-900">{metadata.label}</h3>
      <p className="text-sm text-gray-600 mt-1">{metadata.description}</p>
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

      <code className="text-xs mt-3 block text-gray-400 font-mono">{filePath}</code>
    </button>
  );
}
