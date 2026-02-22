/**
 * POST /api/update-json
 * Updates JSON data in local files (dev) or GitHub repository (production)
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { createGitHubAPI } from "@/lib/github-api";
import type { APIResponse, JSONUpdatePayload } from "@/types/cms";

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
 * Handle POST request to update JSON
 * - Development: Write to local filesystem
 * - Production: Update via GitHub API
 * @param request - Next.js request object
 * @returns JSON response with update status
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let payload: JSONUpdatePayload;
    try {
      payload = (await request.json()) as JSONUpdatePayload;
    } catch {
      const response: APIResponse = {
        success: false,
        error: "Invalid request body",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate required fields
    if (!payload.filePath || !payload.content || !payload.password) {
      const response: APIResponse = {
        success: false,
        error: "Missing required fields: filePath, content, password",
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

    // Validate JSON content
    try {
      JSON.parse(payload.content);
    } catch {
      const response: APIResponse = {
        success: false,
        error: "Invalid JSON content",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // In development, write to local filesystem
    if (process.env.NODE_ENV === "development") {
      try {
        const fullPath = join(process.cwd(), payload.filePath);
        // Format JSON with 2-space indentation for readability
        const formattedContent = JSON.stringify(JSON.parse(payload.content), null, 2);
        await writeFile(fullPath, formattedContent, "utf-8");

        const successResponse: APIResponse = {
          success: true,
          data: {
            sha: "local-dev",
            path: payload.filePath,
          },
          message: "File updated successfully (local development)",
        };

        return NextResponse.json(successResponse);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Failed to write file";
        const response: APIResponse = {
          success: false,
          error: `Failed to write local file: ${errorMsg}`,
          status: 500,
        };
        return NextResponse.json(response, { status: 500 });
      }
    } else {
      // In production, update via GitHub
      try {
        const github = createGitHubAPI();

        // Get current file to retrieve SHA
        const currentFile = await github.getFile(payload.filePath);
        const resolvedPath = currentFile.path || payload.filePath;

        // Update file
        const updatedFile = await github.putFile(
          resolvedPath,
          payload.content,
          "Update JSON data via CMS",
          currentFile.sha
        );

        const successResponse: APIResponse = {
          success: true,
          data: {
            sha: updatedFile.sha,
            path: updatedFile.path,
          },
          message: "File updated successfully (GitHub)",
        };

        return NextResponse.json(successResponse);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "GitHub API error";
        const response: APIResponse = {
          success: false,
          error: `Failed to update via GitHub: ${errorMsg}`,
          status: 500,
        };
        return NextResponse.json(response, { status: 500 });
      }
    }
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
