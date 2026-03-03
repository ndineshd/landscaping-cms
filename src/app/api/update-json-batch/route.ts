import { mkdir, unlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CMS_FILES } from "@/lib/cms-utils";
import { createGitHubAPI } from "@/lib/github-api";
import {
  assertValidMediaContent,
  decodeBase64Content,
  enforceRateLimit,
  InvalidJsonBodyError,
  isJsonRequest,
  parseJsonBodyWithLimit,
  PayloadTooLargeError,
  requireAdminSession,
} from "@/lib/security";
import type { APIResponse } from "@/types/cms";

const ALLOWED_FILE_PATHS = new Set<string>(Object.values(CMS_FILES));
const MEDIA_PATH_PATTERN =
  /^public\/uploads\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|mp4|webm|ogg|mov)$/i;
const MAX_BATCH_BODY_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

const batchSchema = z.object({
  files: z
    .array(
      z.object({
        content: z.string().min(1),
        filePath: z.string().min(1),
      })
    )
    .max(20)
    .optional()
    .default([]),
  mediaDeletes: z.array(z.string().min(1)).max(80).optional().default([]),
  mediaUploads: z
    .array(
      z.object({
        base64Content: z.string().min(1),
        filePath: z.string().min(1),
      })
    )
    .max(80)
    .optional()
    .default([]),
});

function isVideoPath(filePath: string): boolean {
  return /\.(mp4|webm|ogg|mov)$/i.test(filePath);
}

function getMediaMaxSize(filePath: string): number {
  return isVideoPath(filePath) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

function apiError(status: number, error: string): NextResponse {
  const response: APIResponse = {
    error,
    status,
    success: false,
  };
  return NextResponse.json(response, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = enforceRateLimit({
    blockDurationMs: 60 * 1000,
    key: "update-json-batch",
    limit: 20,
    request,
    windowMs: 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const auth = requireAdminSession(request, { requireCsrf: true });
  if (auth.response) return auth.response;

  if (!isJsonRequest(request)) {
    return apiError(415, "Expected JSON request body");
  }

  let payload: z.infer<typeof batchSchema>;
  try {
    const rawPayload = await parseJsonBodyWithLimit<unknown>(
      request,
      MAX_BATCH_BODY_BYTES
    );
    payload = batchSchema.parse(rawPayload);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return apiError(413, "Batch payload exceeds size limit");
    }
    if (error instanceof InvalidJsonBodyError) {
      return apiError(400, "Invalid request body");
    }
    return apiError(400, "Invalid batch payload");
  }

  if (
    payload.files.length === 0 &&
    payload.mediaUploads.length === 0 &&
    payload.mediaDeletes.length === 0
  ) {
    return apiError(400, "Nothing to publish");
  }

  try {
    const normalizedUpdates = payload.files.map((file) => {
      if (!ALLOWED_FILE_PATHS.has(file.filePath)) {
        throw new Error(`Invalid file path: ${file.filePath}`);
      }

      const parsedJSON = JSON.parse(file.content);
      return {
        content: JSON.stringify(parsedJSON, null, 2),
        filePath: file.filePath,
      };
    });

    const normalizedMediaUploads = payload.mediaUploads.map((file) => {
      if (!MEDIA_PATH_PATTERN.test(file.filePath)) {
        throw new Error(`Invalid media upload path: ${file.filePath}`);
      }
      const maxSize = getMediaMaxSize(file.filePath);
      const decoded = decodeBase64Content(file.base64Content, maxSize);
      assertValidMediaContent(file.filePath, decoded);
      return {
        base64Content: file.base64Content.replace(/\s+/g, ""),
        binaryContent: decoded,
        filePath: file.filePath,
      };
    });

    const normalizedMediaDeletes = payload.mediaDeletes.map((filePath) => {
      if (!MEDIA_PATH_PATTERN.test(filePath)) {
        throw new Error(`Invalid media delete path: ${filePath}`);
      }
      return filePath;
    });

    if (process.env.NODE_ENV === "development") {
      for (const update of normalizedUpdates) {
        const fullPath = join(process.cwd(), update.filePath);
        await writeFile(fullPath, update.content, "utf-8");
      }
      for (const upload of normalizedMediaUploads) {
        const fullPath = join(process.cwd(), upload.filePath);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, upload.binaryContent);
      }
      for (const filePath of normalizedMediaDeletes) {
        const fullPath = join(process.cwd(), filePath);
        try {
          await unlink(fullPath);
        } catch (error) {
          const code = (error as NodeJS.ErrnoException | undefined)?.code;
          if (code !== "ENOENT") {
            throw error;
          }
        }
      }

      const successResponse: APIResponse = {
        data: {
          commitSha: "local-dev-batch",
          files: [
            ...normalizedUpdates.map((file) => file.filePath),
            ...normalizedMediaUploads.map((file) => file.filePath),
            ...normalizedMediaDeletes,
          ],
        },
        message: "Batch updated successfully (local development)",
        success: true,
      };
      return NextResponse.json(successResponse);
    }

    const github = createGitHubAPI();
    const batchUpdates = [
      ...normalizedUpdates.map((update) => ({
        action: "upsert" as const,
        content: update.content,
        contentEncoding: "utf-8" as const,
        filePath: update.filePath,
      })),
      ...normalizedMediaUploads.map((upload) => ({
        action: "upsert" as const,
        content: upload.base64Content,
        contentEncoding: "base64" as const,
        filePath: upload.filePath,
      })),
      ...normalizedMediaDeletes.map((filePath) => ({
        action: "delete" as const,
        filePath,
      })),
    ];
    const result = await github.putFilesBatch(
      batchUpdates,
      `CMS publish: ${normalizedUpdates.length} json, ${normalizedMediaUploads.length} uploads, ${normalizedMediaDeletes.length} deletions`
    );

    const successResponse: APIResponse = {
      data: result,
      message: "Batch updated successfully (GitHub)",
      success: true,
    };
    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("[update-json-batch] publish failed", error);
    if (error instanceof PayloadTooLargeError) {
      return apiError(413, "Payload exceeds allowed size");
    }
    if (error instanceof Error) {
      if (error.message.includes("Invalid file path")) {
        return apiError(400, "Invalid file path");
      }
      if (error.message.includes("Invalid media") || error.message.includes("Media content")) {
        return apiError(400, "Invalid media path or content");
      }
      if (error.message.includes("Invalid base64")) {
        return apiError(400, "Invalid media payload");
      }
      if (error.message.includes("Unexpected token")) {
        return apiError(400, "One or more JSON files are invalid");
      }
    }
    return apiError(500, "Failed to publish batch update");
  }
}
