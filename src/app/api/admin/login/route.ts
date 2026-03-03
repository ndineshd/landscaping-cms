import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createAdminSession,
  enforceLoginLockout,
  enforceRateLimit,
  isJsonRequest,
  parseJsonBodyWithLimit,
  recordLoginAttempt,
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/security";

const LOGIN_BODY_LIMIT_BYTES = 16 * 1024;
const loginSchema = z.object({
  password: z.string().trim().min(1).max(256),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = enforceRateLimit({
    blockDurationMs: 5 * 60 * 1000,
    key: "admin-login",
    limit: 20,
    request,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const lockoutResponse = enforceLoginLockout(request);
  if (lockoutResponse) return lockoutResponse;

  if (!isJsonRequest(request)) {
    return NextResponse.json(
      { error: "Expected JSON request body", status: 415, success: false },
      { status: 415 }
    );
  }

  let payload: z.infer<typeof loginSchema>;
  try {
    const raw = await parseJsonBodyWithLimit<unknown>(request, LOGIN_BODY_LIMIT_BYTES);
    payload = loginSchema.parse(raw);
  } catch {
    recordLoginAttempt(request, false);
    return NextResponse.json(
      { error: "Invalid login payload", status: 400, success: false },
      { status: 400 }
    );
  }

  const isValidPassword = await verifyAdminPassword(payload.password);
  if (!isValidPassword) {
    recordLoginAttempt(request, false);
    return NextResponse.json(
      { error: "Invalid credentials", status: 401, success: false },
      { status: 401 }
    );
  }

  const session = createAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: "Admin auth is not configured", status: 500, success: false },
      { status: 500 }
    );
  }

  recordLoginAttempt(request, true);
  const response = NextResponse.json(
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
  setAdminSessionCookie(response, session.token);
  return response;
}
