import { NextRequest, NextResponse } from "next/server";

import {
  clearAdminSessionCookie,
  enforceRateLimit,
  requireAdminSession,
} from "@/lib/security";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = enforceRateLimit({
    key: "admin-logout",
    limit: 60,
    request,
    windowMs: 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const { response } = requireAdminSession(request, { requireCsrf: true });
  if (response) return response;

  const logoutResponse = NextResponse.json(
    { success: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
  clearAdminSessionCookie(logoutResponse);
  return logoutResponse;
}
