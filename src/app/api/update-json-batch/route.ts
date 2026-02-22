/**
 * POST /api/update-json-batch
 * Updates multiple JSON files in one publish operation
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";

import { CMS_FILES } from "@/lib/cms-utils";
import { createGitHubAPI } from "@/lib/github-api";
import type { APIResponse, JSONBatchUpdatePayload } from "@/types/cms";

const ALLOWED_FILE_PATHS = new Set<string>(Object.values(CMS_FILES));

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

    if (!payload.password || !Array.isArray(payload.files) || payload.files.length === 0) {
      const response: APIResponse = {
        success: false,
        error: "Missing required fields: files, password",
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

    const normalizedUpdates = payload.files.map((file) => {
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

    if (process.env.NODE_ENV === "development") {
      for (const update of normalizedUpdates) {
        const fullPath = join(process.cwd(), update.filePath);
        await writeFile(fullPath, update.content, "utf-8");
      }

      const successResponse: APIResponse = {
        success: true,
        data: {
          commitSha: "local-dev-batch",
          files: normalizedUpdates.map((file) => file.filePath),
        },
        message: "Batch updated successfully (local development)",
      };
      return NextResponse.json(successResponse);
    }

    const github = createGitHubAPI();
    const result = await github.putFilesBatch(
      normalizedUpdates.map((update) => ({
        filePath: update.filePath,
        content: update.content,
        contentEncoding: "utf-8",
      })),
      `CMS publish: update ${normalizedUpdates.length} file(s)`
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
