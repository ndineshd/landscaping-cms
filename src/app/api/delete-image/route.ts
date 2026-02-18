/**
 * DELETE /api/delete-image
 * Deletes image from GitHub repository
 */

import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { join } from "path";
import { createGitHubAPI } from "@/lib/github-api";
import type { APIResponse, ImageDeletePayload } from "@/types/cms";

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

/**
 * Handle DELETE request to delete image from GitHub
 * @param request - Next.js request object
 * @returns JSON response with deletion status
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let payload: ImageDeletePayload;
    try {
      payload = (await request.json()) as ImageDeletePayload;
    } catch {
      const response: APIResponse = {
        success: false,
        error: "Invalid request body",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate required fields
    if (!payload.filePath || !payload.password) {
      const response: APIResponse = {
        success: false,
        error: "Missing required fields: filePath, password",
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

    const normalizedPath = normalizeImagePath(payload.filePath);
    if (!normalizedPath) {
      const response: APIResponse = {
        success: false,
        error: "Invalid image path",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

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
        success: true,
        data: {
          path: normalizedPath,
        },
        message: "Image deleted successfully (local development)",
      };

      return NextResponse.json(successResponse);
    }

    // Initialize GitHub API
    const github = createGitHubAPI();

    // Get file to retrieve SHA
    let fileData;
    try {
      fileData = await github.getFile(normalizedPath);
    } catch {
      const response: APIResponse = {
        success: false,
        error: `File not found: ${normalizedPath}`,
        status: 404,
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Delete file
    await github.deleteFile(
      normalizedPath,
      fileData.sha,
      `Delete image: ${normalizedPath}`
    );

    const successResponse: APIResponse = {
      success: true,
      data: {
        path: `/${normalizedPath.replace(/^public\//, "")}`,
      },
      message: "Image deleted successfully",
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
