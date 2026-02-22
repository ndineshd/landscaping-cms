/**
 * POST /api/update-json-batch
 * Updates multiple JSON files in one publish operation
 */

import { NextRequest, NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { CMS_FILES } from "@/lib/cms-utils";
import { createGitHubAPI } from "@/lib/github-api";
import type { APIResponse, JSONBatchUpdatePayload } from "@/types/cms";

const ALLOWED_FILE_PATHS = new Set<string>(Object.values(CMS_FILES));
const MEDIA_PATH_PATTERN = /^public\/uploads\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|mp4|webm|ogg|mov)$/i;

function validatePassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD environment variable not set");
    return false;
  }
  return password === adminPassword;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let payload: JSONBatchUpdatePayload;
    try {
      payload = (await request.json()) as JSONBatchUpdatePayload;
    } catch {
      const response: APIResponse = {
        success: false,
        error: "Invalid request body",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    const fileUpdates = Array.isArray(payload.files) ? payload.files : [];
    const mediaUploads = Array.isArray(payload.mediaUploads)
      ? payload.mediaUploads
      : [];
    const mediaDeletes = Array.isArray(payload.mediaDeletes)
      ? payload.mediaDeletes
      : [];

    if (!payload.password) {
      const response: APIResponse = {
        success: false,
        error: "Missing required field: password",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }
    if (
      fileUpdates.length === 0 &&
      mediaUploads.length === 0 &&
      mediaDeletes.length === 0
    ) {
      const response: APIResponse = {
        success: false,
        error: "Nothing to publish",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!validatePassword(payload.password)) {
      const response: APIResponse = {
        success: false,
        error: "Invalid password",
        status: 401,
      };
      return NextResponse.json(response, { status: 401 });
    }

    const normalizedUpdates = fileUpdates.map((file) => {
      if (!file.filePath || typeof file.content !== "string") {
        throw new Error("Each file must include filePath and content");
      }
      if (!ALLOWED_FILE_PATHS.has(file.filePath)) {
        throw new Error(`Invalid file path: ${file.filePath}`);
      }

      const parsedJSON = JSON.parse(file.content);
      return {
        filePath: file.filePath,
        content: JSON.stringify(parsedJSON, null, 2),
      };
    });
    const normalizedMediaUploads = mediaUploads.map((file) => {
      if (!file.filePath || typeof file.base64Content !== "string") {
        throw new Error("Each media upload must include filePath and base64Content");
      }
      if (!MEDIA_PATH_PATTERN.test(file.filePath)) {
        throw new Error(`Invalid media upload path: ${file.filePath}`);
      }
      return {
        filePath: file.filePath,
        base64Content: file.base64Content,
      };
    });
    const normalizedMediaDeletes = mediaDeletes.map((filePath) => {
      if (typeof filePath !== "string" || !MEDIA_PATH_PATTERN.test(filePath)) {
        throw new Error(`Invalid media delete path: ${String(filePath)}`);
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
        await writeFile(fullPath, Buffer.from(upload.base64Content, "base64"));
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
        success: true,
        data: {
          commitSha: "local-dev-batch",
          files: [
            ...normalizedUpdates.map((file) => file.filePath),
            ...normalizedMediaUploads.map((file) => file.filePath),
            ...normalizedMediaDeletes,
          ],
        },
        message: "Batch updated successfully (local development)",
      };
      return NextResponse.json(successResponse);
    }

    const github = createGitHubAPI();
    const batchUpdates = [
      ...normalizedUpdates.map((update) => ({
        filePath: update.filePath,
        content: update.content,
        contentEncoding: "utf-8" as const,
        action: "upsert" as const,
      })),
      ...normalizedMediaUploads.map((upload) => ({
        filePath: upload.filePath,
        content: upload.base64Content,
        contentEncoding: "base64" as const,
        action: "upsert" as const,
      })),
      ...normalizedMediaDeletes.map((filePath) => ({
        filePath,
        action: "delete" as const,
      })),
    ];
    const result = await github.putFilesBatch(
      batchUpdates,
      `CMS publish: ${normalizedUpdates.length} json, ${normalizedMediaUploads.length} uploads, ${normalizedMediaDeletes.length} deletions`
    );

    const successResponse: APIResponse = {
      success: true,
      data: result,
      message: "Batch updated successfully (GitHub)",
    };
    return NextResponse.json(successResponse);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    const response: APIResponse = {
      success: false,
      error: errorMessage,
      status: 500,
    };
    return NextResponse.json(response, { status: 500 });
  }
}
