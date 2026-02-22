"use client";

import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface PublishSummary {
  successCount: number;
  failedCount: number;
  publishedFiles: string[];
}

interface PublishSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publishSummary: PublishSummary | null;
  getFileLabel: (filePath: string) => string;
}

export function PublishSummaryDialog({
  open,
  onOpenChange,
  publishSummary,
  getFileLabel,
}: PublishSummaryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <p className="font-medium text-slate-800">{publishSummary.successCount} file(s) updated</p>
            {publishSummary.failedCount > 0 && (
              <p className="text-red-600">{publishSummary.failedCount} file(s) failed to update</p>
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
  );
}
