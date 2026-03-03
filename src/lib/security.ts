import { compare } from "bcryptjs";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const JSON_CONTENT_TYPE = "application/json";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const ADMIN_SESSION_COOKIE_NAME = IS_PRODUCTION
  ? "__Host-admin_session"
  : "admin_session";
export const ADMIN_CSRF_HEADER_NAME = "x-csrf-token";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const MAX_RATE_LIMIT_BUCKETS = 5_000;
const MAX_LOGIN_TRACKERS = 2_000;

interface AdminSessionPayload {
  csrfToken: string;
  exp: number;
  iat: number;
  nonce: string;
  sub: "admin";
  v: 1;
}

interface RateLimitState {
  blockedUntil: number;
  count: number;
  windowStart: number;
}

interface LoginFailureState {
  blockedUntil: number;
  failures: number;
  lastFailureAt: number;
}

export interface AuthenticatedAdminSession {
  csrfToken: string;
  expiresAtEpochSeconds: number;
}

export interface CreatedAdminSession extends AuthenticatedAdminSession {
  token: string;
}

export interface RequireAdminSessionOptions {
  requireCsrf?: boolean;
}

export interface RateLimitOptions {
  blockDurationMs?: number;
  key: string;
  limit: number;
  request: NextRequest;
  windowMs: number;
}

const rateLimitStore = new Map<string, RateLimitState>();
const loginFailureStore = new Map<string, LoginFailureState>();

export class PayloadTooLargeError extends Error {
  constructor(message = "Payload too large") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export class InvalidJsonBodyError extends Error {
  constructor(message = "Invalid JSON body") {
    super(message);
    this.name = "InvalidJsonBodyError";
  }
}

function cleanStoreSize<T>(store: Map<string, T>, maxSize: number): void {
  if (store.size <= maxSize) return;
  const overBy = store.size - maxSize;
  const keys = Array.from(store.keys()).slice(0, overBy);
  keys.forEach((key) => {
    store.delete(key);
  });
}

function jsonError(status: number, message: string, retryAfterSeconds?: number): NextResponse {
  const headers: HeadersInit = { "Cache-Control": "no-store" };
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }
  return NextResponse.json(
    {
      error: message,
      status,
      success: false,
    },
    { status, headers }
  );
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function getSessionSecret(): string | null {
  const configuredSecret = (process.env.ADMIN_SESSION_SECRET || "").trim();
  if (configuredSecret) return configuredSecret;

  if (IS_PRODUCTION) {
    return null;
  }

  const developmentFallback =
    (process.env.ADMIN_PASSWORD_HASH || "").trim() ||
    (process.env.ADMIN_PASSWORD || "").trim();
  return developmentFallback || null;
}

function getSessionDurationSeconds(): number {
  const parsed = Number(process.env.ADMIN_SESSION_MAX_AGE_SECONDS || "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return SESSION_DURATION_SECONDS;
  }
  return Math.min(Math.floor(parsed), 60 * 60 * 24 * 14);
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf-8");
  const rightBytes = Buffer.from(right, "utf-8");
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
}

function signSessionPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function createSessionToken(session: AdminSessionPayload): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  const encodedPayload = base64UrlEncode(JSON.stringify(session));
  const signature = signSessionPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function parseSessionToken(rawToken: string): AdminSessionPayload | null {
  const token = rawToken.trim();
  if (!token.includes(".")) {
    return null;
  }

  const [encodedPayload, encodedSignature] = token.split(".", 2);
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const expectedSignature = signSessionPayload(encodedPayload, secret);
  if (!timingSafeStringEqual(expectedSignature, encodedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as AdminSessionPayload;
    if (
      parsed.sub !== "admin" ||
      parsed.v !== 1 ||
      typeof parsed.csrfToken !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getRequestIP(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") || "unknown";
}

function getRateLimitKey(routeKey: string, request: NextRequest): string {
  return `${routeKey}:${getRequestIP(request)}`;
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function getLoginFailureKey(request: NextRequest): string {
  return getRateLimitKey("admin-login", request);
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const normalizedPassword = password.trim();
  if (!normalizedPassword) return false;

  const hash = (process.env.ADMIN_PASSWORD_HASH || "").trim();
  if (hash) {
    try {
      return await compare(normalizedPassword, hash);
    } catch {
      return false;
    }
  }

  if (IS_PRODUCTION) {
    return false;
  }

  const developmentPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (!developmentPassword) return false;
  return timingSafeStringEqual(normalizedPassword, developmentPassword);
}

export function createAdminSession(): CreatedAdminSession | null {
  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  const expiresAtEpochSeconds = nowEpochSeconds + getSessionDurationSeconds();
  const sessionPayload: AdminSessionPayload = {
    csrfToken: randomBytes(24).toString("hex"),
    exp: expiresAtEpochSeconds,
    iat: nowEpochSeconds,
    nonce: randomBytes(18).toString("base64url"),
    sub: "admin",
    v: 1,
  };
  const token = createSessionToken(sessionPayload);
  if (!token) return null;

  return {
    csrfToken: sessionPayload.csrfToken,
    expiresAtEpochSeconds,
    token,
  };
}

export function setAdminSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: getSessionDurationSeconds(),
    path: "/",
    sameSite: "strict",
    secure: IS_PRODUCTION,
  });
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: IS_PRODUCTION,
  });
}

export function requireAdminSession(
  request: NextRequest,
  options: RequireAdminSessionOptions = {}
): { response?: NextResponse; session?: AuthenticatedAdminSession } {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value || "";
  if (!token) {
    return {
      response: jsonError(401, "Authentication required"),
    };
  }

  const parsedSession = parseSessionToken(token);
  if (!parsedSession) {
    return {
      response: jsonError(401, "Session expired. Please log in again."),
    };
  }

  if (options.requireCsrf) {
    if (!isSameOriginRequest(request)) {
      return {
        response: jsonError(403, "Invalid request origin"),
      };
    }
    const csrfToken = request.headers.get(ADMIN_CSRF_HEADER_NAME) || "";
    if (!csrfToken || !timingSafeStringEqual(csrfToken, parsedSession.csrfToken)) {
      return {
        response: jsonError(403, "CSRF validation failed"),
      };
    }
  }

  return {
    session: {
      csrfToken: parsedSession.csrfToken,
      expiresAtEpochSeconds: parsedSession.exp,
    },
  };
}

export function enforceRateLimit({
  blockDurationMs = 0,
  key,
  limit,
  request,
  windowMs,
}: RateLimitOptions): NextResponse | null {
  const fullKey = getRateLimitKey(key, request);
  const now = Date.now();
  const existing = rateLimitStore.get(fullKey);

  if (existing?.blockedUntil && existing.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((existing.blockedUntil - now) / 1000);
    return jsonError(429, "Too many requests", retryAfterSeconds);
  }

  if (!existing || now - existing.windowStart >= windowMs) {
    rateLimitStore.set(fullKey, {
      blockedUntil: 0,
      count: 1,
      windowStart: now,
    });
    cleanStoreSize(rateLimitStore, MAX_RATE_LIMIT_BUCKETS);
    return null;
  }

  existing.count += 1;

  if (existing.count > limit) {
    const blockedUntil = blockDurationMs > 0 ? now + blockDurationMs : now + windowMs;
    existing.blockedUntil = blockedUntil;
    const retryAfterSeconds = Math.ceil((blockedUntil - now) / 1000);
    return jsonError(429, "Too many requests", retryAfterSeconds);
  }

  return null;
}

export function enforceLoginLockout(request: NextRequest): NextResponse | null {
  const state = loginFailureStore.get(getLoginFailureKey(request));
  if (!state) return null;
  if (state.blockedUntil <= Date.now()) {
    return null;
  }
  const retryAfterSeconds = Math.ceil((state.blockedUntil - Date.now()) / 1000);
  return jsonError(429, "Too many failed login attempts", retryAfterSeconds);
}

export function recordLoginAttempt(request: NextRequest, success: boolean): void {
  const key = getLoginFailureKey(request);
  const now = Date.now();
  const existing = loginFailureStore.get(key);

  if (success) {
    loginFailureStore.delete(key);
    return;
  }

  const previousFailures =
    existing && now - existing.lastFailureAt < 30 * 60 * 1000 ? existing.failures : 0;
  const failures = previousFailures + 1;
  const lockoutExponent = Math.max(0, failures - 4);
  const lockoutSeconds = failures < 5 ? 0 : Math.min(900, 2 ** lockoutExponent);

  loginFailureStore.set(key, {
    blockedUntil: lockoutSeconds > 0 ? now + lockoutSeconds * 1000 : 0,
    failures,
    lastFailureAt: now,
  });
  cleanStoreSize(loginFailureStore, MAX_LOGIN_TRACKERS);
}

export function isJsonRequest(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type") || "";
  return contentType.toLowerCase().includes(JSON_CONTENT_TYPE);
}

export async function parseJsonBodyWithLimit<T>(
  request: NextRequest,
  maxBytes: number
): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") || "");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new PayloadTooLargeError();
  }

  const rawBody = await request.text();
  const bodyByteLength = Buffer.byteLength(rawBody, "utf-8");
  if (bodyByteLength > maxBytes) {
    throw new PayloadTooLargeError();
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new InvalidJsonBodyError();
  }
}

export function decodeBase64Content(base64Value: string, maxBytes: number): Buffer {
  const sanitized = base64Value.replace(/\s+/g, "");
  if (!sanitized || !/^[A-Za-z0-9+/]+={0,2}$/.test(sanitized)) {
    throw new Error("Invalid base64 payload");
  }

  const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
  const estimatedBytes = Math.floor((sanitized.length * 3) / 4) - padding;
  if (estimatedBytes <= 0 || estimatedBytes > maxBytes) {
    throw new PayloadTooLargeError("Base64 payload exceeds allowed size");
  }

  const buffer = Buffer.from(sanitized, "base64");
  if (buffer.length <= 0 || buffer.length > maxBytes) {
    throw new PayloadTooLargeError("Decoded payload exceeds allowed size");
  }
  return buffer;
}

function getFileExtension(pathOrName: string): string {
  const normalized = pathOrName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex + 1) : "";
}

function isJPEG(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPNG(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function isWebP(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

function isMp4OrMov(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
}

function isWebM(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
}

function isOgg(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "OggS";
}

export function assertValidMediaContent(pathOrName: string, buffer: Buffer): void {
  const extension = getFileExtension(pathOrName);
  const mediaValidators: Record<string, (value: Buffer) => boolean> = {
    jpeg: isJPEG,
    jpg: isJPEG,
    mov: isMp4OrMov,
    mp4: isMp4OrMov,
    ogg: isOgg,
    png: isPNG,
    webm: isWebM,
    webp: isWebP,
  };
  const validator = mediaValidators[extension];
  if (!validator || !validator(buffer)) {
    throw new Error("Media content does not match file extension");
  }
}

export function getGenericServerErrorResponse(): NextResponse {
  return jsonError(500, "Internal server error");
}

export function logSecurityError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}

export function getAuthenticatedSessionResponse(
  csrfToken: string,
  expiresAtEpochSeconds: number
): NextResponse {
  return NextResponse.json(
    {
      data: {
        csrfToken,
        expiresAtEpochSeconds,
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
