import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

const UPLOAD_BODY_LIMIT_BYTES = 12 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const uploadSchema = z.object({
  base64Content: z.string().min(1),
  fileName: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp|mp4|webm|ogg|mov)$/i),
  folder: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9/_-]+$/)
    .optional(),
});

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
    key: "upload-image",
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

  let payload: z.infer<typeof uploadSchema>;
  try {
    const rawPayload = await parseJsonBodyWithLimit<unknown>(
      request,
      UPLOAD_BODY_LIMIT_BYTES
    );
    payload = uploadSchema.parse(rawPayload);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return apiError(413, "Upload payload exceeds size limit");
    }
    if (error instanceof InvalidJsonBodyError) {
      return apiError(400, "Invalid request body");
    }
    return apiError(400, "Invalid upload payload");
  }

  if (payload.folder && payload.folder.includes("..")) {
    return apiError(400, "Invalid folder path");
  }

  const folderSegment = payload.folder ? `/${payload.folder}` : "";
  const filePath = `public/uploads${folderSegment}/${payload.fileName}`;
  const publicPath = `/uploads${folderSegment}/${payload.fileName}`;

  try {
    const binaryContent = decodeBase64Content(payload.base64Content, MAX_UPLOAD_BYTES);
    assertValidMediaContent(payload.fileName, binaryContent);

    if (process.env.NODE_ENV === "development") {
      const fullPath = join(process.cwd(), filePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, binaryContent);

      const successResponse: APIResponse = {
        data: {
          fileName: payload.fileName,
          path: publicPath,
          sha: "local-dev",
        },
        message: "Media uploaded successfully (local development)",
        success: true,
      };

      return NextResponse.json(successResponse);
    }

    const github = createGitHubAPI();
    let sha: string | undefined;

    try {
      const existingFile = await github.getFile(filePath);
      sha = existingFile.sha;
    } catch {
      sha = undefined;
    }

    const uploadedFile = await github.putFile(
      filePath,
      payload.base64Content.replace(/\s+/g, ""),
      `Upload media: ${payload.fileName}`,
      sha,
      { contentEncoding: "base64" }
    );

    const successResponse: APIResponse = {
      data: {
        fileName: payload.fileName,
        path: publicPath,
        sha: uploadedFile.sha,
      },
      message: "Media uploaded successfully",
      success: true,
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("[upload-image] failed", error);
    if (error instanceof PayloadTooLargeError) {
      return apiError(413, "Media file exceeds allowed size");
    }
    if (error instanceof Error && error.message.includes("Media content")) {
      return apiError(400, "Uploaded media content did not match extension");
    }
    if (error instanceof Error && error.message.includes("Invalid base64")) {
      return apiError(400, "Invalid media payload");
    }
    return apiError(500, "Failed to upload media");
  }
}
