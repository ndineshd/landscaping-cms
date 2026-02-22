/**
 * GET /api/get-json
 * Fetches JSON data from local files (dev) or GitHub repository (production)
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { createGitHubAPI } from "@/lib/github-api";
import { CMS_FILES } from "@/lib/cms-utils";
import type { APIResponse } from "@/types/cms";

const ADMIN_PASSWORD_HEADER = "x-admin-password";
const ALLOWED_FILE_PATHS = new Set<string>(Object.values(CMS_FILES));

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
 * Handle GET request to fetch JSON
 * - Development: Read from local filesystem
 * - Production: Fetch from GitHub API
 * @param request - Next.js request object
 * @returns JSON response with file content
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const providedPassword = request.headers.get(ADMIN_PASSWORD_HEADER) || "";
    if (!validatePassword(providedPassword)) {
      const response: APIResponse = {
        success: false,
        error: "Invalid password",
        status: 401,
      };
      return NextResponse.json(response, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Get filePath from query parameters
    const filePath = request.nextUrl.searchParams.get("filePath");

    if (!filePath) {
      const response: APIResponse = {
        success: false,
        error: "filePath query parameter is required",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }
    if (!ALLOWED_FILE_PATHS.has(filePath)) {
      const response: APIResponse = {
        success: false,
        error: "Invalid file path",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    let jsonData: unknown;
    let sha = "";

    // In development, read from local filesystem
    if (process.env.NODE_ENV === "development") {
      try {
        // Get the file path relative to project root
        const fullPath = join(process.cwd(), filePath);
        const fileContent = await readFile(fullPath, "utf-8");
        jsonData = JSON.parse(fileContent);
        sha = "local-dev"; // Mock SHA for development
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Failed to read file";
        const response: APIResponse = {
          success: false,
          error: `Failed to read local file: ${errorMsg}`,
          status: 404,
        };
        return NextResponse.json(response, { status: 404 });
      }
    } else {
      // In production, fetch from GitHub
      try {
        const github = createGitHubAPI();
        const fileData = await github.getFile(filePath);

        if (!fileData.content) {
          const response: APIResponse = {
            success: false,
            error: "File content not found",
            status: 404,
          };
          return NextResponse.json(response, { status: 404 });
        }

        const decodedContent = Buffer.from(
          fileData.content,
          "base64"
        ).toString("utf-8");
        jsonData = JSON.parse(decodedContent);
        sha = fileData.sha || "";
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "GitHub API error";
        const response: APIResponse = {
          success: false,
          error: `Failed to fetch from GitHub: ${errorMsg}`,
          status: 500,
        };
        return NextResponse.json(response, { status: 500 });
      }
    }

    const successResponse: APIResponse = {
      success: true,
      data: {
        content: jsonData,
        sha,
      },
      message: "File fetched successfully",
    };

    return NextResponse.json(successResponse, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    const response: APIResponse = {
      success: false,
      error: errorMessage,
      status: 500,
    };

    return NextResponse.json(response, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
