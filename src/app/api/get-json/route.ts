import { readFile } from "fs/promises";
import { join } from "path";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CMS_FILES } from "@/lib/cms-utils";
import { createGitHubAPI } from "@/lib/github-api";
import { enforceRateLimit, requireAdminSession } from "@/lib/security";
import type { APIResponse } from "@/types/cms";

const ALLOWED_FILE_PATHS = new Set<string>(Object.values(CMS_FILES));
const querySchema = z.object({
  filePath: z.string().min(1),
});

function errorResponse(status: number, error: string): NextResponse {
  const response: APIResponse = {
    error,
    status,
    success: false,
  };
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = enforceRateLimit({
    key: "get-json",
    limit: 120,
    request,
    windowMs: 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const { response } = requireAdminSession(request);
  if (response) return response;

  let parsedQuery: z.infer<typeof querySchema>;
  try {
    parsedQuery = querySchema.parse({
      filePath: request.nextUrl.searchParams.get("filePath") || "",
    });
  } catch {
    return errorResponse(400, "filePath query parameter is required");
  }

  if (!ALLOWED_FILE_PATHS.has(parsedQuery.filePath)) {
    return errorResponse(400, "Invalid file path");
  }

  try {
    let jsonData: unknown;
    let sha = "";

    if (process.env.NODE_ENV === "development") {
      const fullPath = join(process.cwd(), parsedQuery.filePath);
      const fileContent = await readFile(fullPath, "utf-8");
      jsonData = JSON.parse(fileContent);
      sha = "local-dev";
    } else {
      const github = createGitHubAPI();
      const fileData = await github.getFile(parsedQuery.filePath);
      if (!fileData.content) {
        return errorResponse(404, "File content not found");
      }
      const decodedContent = Buffer.from(fileData.content, "base64").toString("utf-8");
      jsonData = JSON.parse(decodedContent);
      sha = fileData.sha || "";
    }

    const successResponse: APIResponse = {
      data: {
        content: jsonData,
        sha,
      },
      message: "File fetched successfully",
      success: true,
    };

    return NextResponse.json(successResponse, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[get-json] failed to fetch file", error);
    return errorResponse(500, "Failed to fetch file");
  }
}
