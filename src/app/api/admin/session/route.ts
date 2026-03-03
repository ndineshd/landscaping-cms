import { NextRequest, NextResponse } from "next/server";

import { enforceRateLimit, requireAdminSession } from "@/lib/security";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = enforceRateLimit({
    key: "admin-session",
    limit: 120,
    request,
    windowMs: 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const { response, session } = requireAdminSession(request);
  if (response || !session) {
    return (
      response ||
      NextResponse.json(
        { error: "Authentication required", status: 401, success: false },
        { status: 401 }
      )
    );
  }

  return NextResponse.json(
    {
      data: {
        csrfToken: session.csrfToken,
        expiresAtEpochSeconds: session.expiresAtEpochSeconds,
      },
      success: true,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
