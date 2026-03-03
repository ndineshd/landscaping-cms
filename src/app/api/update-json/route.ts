import { NextResponse } from "next/server";
import type { APIResponse } from "@/types/cms";

/**
 * Legacy endpoint intentionally disabled.
 * Use /api/update-json-batch with strict allowlists instead.
 */
export async function POST(): Promise<NextResponse> {
  const response: APIResponse = {
    error: "This endpoint is disabled. Use /api/update-json-batch.",
    status: 410,
    success: false,
  };
  return NextResponse.json(response, { status: 410 });
}
