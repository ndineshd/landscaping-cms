/**
 * POST /api/upload-image
 * Uploads media files to GitHub repository
 */

import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { createGitHubAPI } from "@/lib/github-api";
import type { APIResponse, ImageUploadPayload } from "@/types/cms";

/**
 * Validate admin password
 * @param password - Password to validate
 * @returns True if password is correct
 */
function validatePassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD environment variable not set");
    return false;
  }
  return password === adminPassword;
}

/**
 * Validate upload file name
 * @param fileName - File name to validate
 * @returns True if file name is valid
 */
function validateFileName(fileName: string): boolean {
  // Only allow alphanumeric, dash, underscore, and dot
  const validNamePattern =
    /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp|mp4|webm|ogg|mov)$/i;
  return validNamePattern.test(fileName);
}

/**
 * Validate upload folder
 * @param folder - Folder path to validate
 * @returns True if folder is valid
 */
function validateFolder(folder: string): boolean {
  if (!folder) return true;
  if (folder.includes("..")) return false;
  if (folder.startsWith("/") || folder.endsWith("/")) return false;
  return /^[a-zA-Z0-9/_-]+$/.test(folder);
}

/**
 * Handle POST request to upload media to GitHub
 * @param request - Next.js request object
 * @returns JSON response with upload status and media path
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let payload: ImageUploadPayload;
    try {
      payload = (await request.json()) as ImageUploadPayload;
    } catch {
      const response: APIResponse = {
        success: false,
        error: "Invalid request body",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate required fields
    if (!payload.fileName || !payload.base64Content || !payload.password) {
      const response: APIResponse = {
        success: false,
        error: "Missing required fields: fileName, base64Content, password",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate password
    if (!validatePassword(payload.password)) {
      const response: APIResponse = {
        success: false,
        error: "Invalid password",
        status: 401,
      };
      return NextResponse.json(response, { status: 401 });
    }

    // Validate file name
    if (!validateFileName(payload.fileName)) {
      const response: APIResponse = {
        success: false,
        error:
          "Invalid file name. Only alphanumeric, dash, underscore allowed. Must end with .jpg, .jpeg, .png, .webp, .mp4, .webm, .ogg, or .mov",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (payload.folder && !validateFolder(payload.folder)) {
      const response: APIResponse = {
        success: false,
        error: "Invalid folder path",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    const folderSegment = payload.folder ? `/${payload.folder}` : "";
    const filePath = `public/uploads${folderSegment}/${payload.fileName}`;
    const publicPath = `/uploads${folderSegment}/${payload.fileName}`;

    if (process.env.NODE_ENV === "development") {
      const fullPath = join(process.cwd(), filePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, Buffer.from(payload.base64Content, "base64"));

      const successResponse: APIResponse = {
        success: true,
        data: {
          path: publicPath,
          sha: "local-dev",
          fileName: payload.fileName,
        },
        message: "Media uploaded successfully (local development)",
      };

      return NextResponse.json(successResponse);
    }

    // Initialize GitHub API
    const github = createGitHubAPI();
    let sha: string | undefined;

    try {
      const existingFile = await github.getFile(filePath);
      sha = existingFile.sha;
    } catch {
      sha = undefined;
    }

    // Upload media
    const uploadedFile = await github.putFile(
      filePath,
      payload.base64Content,
      `Upload media: ${payload.fileName}`,
      sha,
      { contentEncoding: "base64" }
    );

    const successResponse: APIResponse = {
      success: true,
      data: {
        path: publicPath,
        sha: uploadedFile.sha,
        fileName: payload.fileName,
      },
      message: "Media uploaded successfully",
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
