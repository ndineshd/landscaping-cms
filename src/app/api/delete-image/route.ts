import { readFile, unlink } from "fs/promises";
import { join } from "path";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CMS_FILES } from "@/lib/cms-utils";
import { createGitHubAPI } from "@/lib/github-api";
import {
  enforceRateLimit,
  InvalidJsonBodyError,
  isJsonRequest,
  parseJsonBodyWithLimit,
  PayloadTooLargeError,
  requireAdminSession,
} from "@/lib/security";
import type { APIResponse } from "@/types/cms";

const DELETE_BODY_LIMIT_BYTES = 16 * 1024;
const deleteSchema = z.object({
  filePath: z.string().trim().min(1),
});

function normalizeImagePath(filePath: string): string | null {
  const sanitizedInput = filePath.trim().replace(/\\/g, "/");
  if (!sanitizedInput || sanitizedInput.includes("..")) return null;

  let normalized = sanitizedInput.startsWith("/")
    ? sanitizedInput.slice(1)
    : sanitizedInput;

  if (normalized.startsWith("uploads/")) {
    normalized = `public/${normalized}`;
  }

  if (!normalized.startsWith("public/uploads/")) {
    return null;
  }

  return normalized;
}

function toPublicUploadPath(normalizedFilePath: string): string {
  return `/${normalizedFilePath.replace(/^public\//, "")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countUploadPathReferences(value: unknown, targetPath: string): number {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry === targetPath).length;
  }

  if (Array.isArray(value)) {
    return value.reduce<number>((total, entry) => {
      return total + countUploadPathReferences(entry, targetPath);
    }, 0);
  }

  if (isRecord(value)) {
    return Object.values(value).reduce<number>((total, entry) => {
      return total + countUploadPathReferences(entry, targetPath);
    }, 0);
  }

  return 0;
}

async function loadCMSFileData(filePath: string): Promise<unknown> {
  if (process.env.NODE_ENV === "development") {
    const fullPath = join(process.cwd(), filePath);
    const fileContent = await readFile(fullPath, "utf-8");
    return JSON.parse(fileContent);
  }

  const github = createGitHubAPI();
  const fileData = await github.getFile(filePath);
  const decoded = Buffer.from(fileData.content || "", "base64").toString("utf-8");
  return JSON.parse(decoded);
}

async function countUploadReferencesAcrossCMS(publicPath: string): Promise<number | null> {
  try {
    let totalReferences = 0;
    for (const cmsFilePath of Object.values(CMS_FILES)) {
      const content = await loadCMSFileData(cmsFilePath);
      totalReferences += countUploadPathReferences(content, publicPath);
    }
    return totalReferences;
  } catch (error) {
    console.error("[delete-image] failed to inspect references", error);
    return null;
  }
}

function apiError(status: number, error: string): NextResponse {
  const response: APIResponse = {
    error,
    status,
    success: false,
  };
  return NextResponse.json(response, { status });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = enforceRateLimit({
    blockDurationMs: 60 * 1000,
    key: "delete-image",
    limit: 30,
    request,
    windowMs: 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const auth = requireAdminSession(request, { requireCsrf: true });
  if (auth.response) return auth.response;

  if (!isJsonRequest(request)) {
    return apiError(415, "Expected JSON request body");
  }

  let payload: z.infer<typeof deleteSchema>;
  try {
    const rawPayload = await parseJsonBodyWithLimit<unknown>(
      request,
      DELETE_BODY_LIMIT_BYTES
    );
    payload = deleteSchema.parse(rawPayload);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return apiError(413, "Request payload exceeds size limit");
    }
    if (error instanceof InvalidJsonBodyError) {
      return apiError(400, "Invalid request body");
    }
    return apiError(400, "Invalid delete payload");
  }

  const normalizedPath = normalizeImagePath(payload.filePath);
  if (!normalizedPath) {
    return apiError(400, "Invalid image path");
  }

  const publicPath = toPublicUploadPath(normalizedPath);
  const referenceCount = await countUploadReferencesAcrossCMS(publicPath);

  if (referenceCount === null) {
    const safeSkipResponse: APIResponse = {
      data: {
        deleted: false,
        path: publicPath,
        reason: "Unable to verify references safely",
        skipped: true,
      },
      message: "Image deletion skipped because references could not be verified",
      success: true,
    };
    return NextResponse.json(safeSkipResponse);
  }

  if (referenceCount > 0) {
    const skippedResponse: APIResponse = {
      data: {
        deleted: false,
        path: publicPath,
        references: referenceCount,
        skipped: true,
      },
      message: "Image deletion skipped because path is still referenced",
      success: true,
    };
    return NextResponse.json(skippedResponse);
  }

  try {
    if (process.env.NODE_ENV === "development") {
      const fullPath = join(process.cwd(), normalizedPath);
      try {
        await unlink(fullPath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code !== "ENOENT") {
          throw error;
        }
      }

      const successResponse: APIResponse = {
        data: {
          deleted: true,
          path: publicPath,
        },
        message: "Image deleted successfully (local development)",
        success: true,
      };

      return NextResponse.json(successResponse);
    }

    const github = createGitHubAPI();
    let fileData;
    try {
      fileData = await github.getFile(normalizedPath);
    } catch {
      return apiError(404, "File not found");
    }

    await github.deleteFile(normalizedPath, fileData.sha, `Delete image: ${normalizedPath}`);

    const successResponse: APIResponse = {
      data: {
        deleted: true,
        path: publicPath,
      },
      message: "Image deleted successfully",
      success: true,
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("[delete-image] failed", error);
    return apiError(500, "Failed to delete image");
  }
}
