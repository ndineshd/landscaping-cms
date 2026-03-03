import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  enforceRateLimit,
  InvalidJsonBodyError,
  isJsonRequest,
  parseJsonBodyWithLimit,
  PayloadTooLargeError,
  requireAdminSession,
} from "@/lib/security";
import type { APIResponse } from "@/types/cms";

const GOOGLE_TRANSLATE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";
const GOOGLE_LANGUAGE_CODE_MAP: Record<string, string> = {
  tel: "te",
};
const TRANSLATE_BODY_LIMIT_BYTES = 512 * 1024;
const MAX_TEXT_LENGTH = 4_000;

const translateSchema = z.object({
  sourceLanguage: z.string().trim().min(1).max(16),
  targetLanguage: z.string().trim().min(1).max(16),
  texts: z.array(z.string().max(MAX_TEXT_LENGTH)).min(1).max(200),
});

function normalizeLanguageCode(code: string): string {
  return code.trim().toLowerCase();
}

function mapToGoogleLanguageCode(code: string): string {
  const normalized = normalizeLanguageCode(code);
  return GOOGLE_LANGUAGE_CODE_MAP[normalized] || normalized;
}

function parseGoogleTranslateResponse(value: unknown): string | null {
  if (!Array.isArray(value) || !Array.isArray(value[0])) {
    return null;
  }

  const segments = value[0];
  const translated = segments
    .map((segment) =>
      Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : ""
    )
    .join("");

  return translated || null;
}

function chunkArray<T>(value: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks;
}

function isExternalTranslationEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return (process.env.ENABLE_EXTERNAL_TRANSLATION || "").trim().toLowerCase() === "true";
}

async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  if (!text.trim()) {
    return text;
  }

  const params = new URLSearchParams({
    client: "gtx",
    dt: "t",
    q: text,
    sl: sourceLanguage,
    tl: targetLanguage,
  });

  const response = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?${params.toString()}`, {
    cache: "no-store",
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Google Translate request failed with status ${response.status}`);
  }

  const parsed = (await response.json()) as unknown;
  const translated = parseGoogleTranslateResponse(parsed);
  return translated ?? text;
}

function apiError(status: number, error: string): NextResponse {
  const response: APIResponse = {
    error,
    status,
    success: false,
  };
  return NextResponse.json(response, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = enforceRateLimit({
    blockDurationMs: 30 * 1000,
    key: "translate",
    limit: 20,
    request,
    windowMs: 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const auth = requireAdminSession(request, { requireCsrf: true });
  if (auth.response) return auth.response;

  if (!isExternalTranslationEnabled()) {
    return apiError(503, "External translation is disabled");
  }

  if (!isJsonRequest(request)) {
    return apiError(415, "Expected JSON request body");
  }

  let payload: z.infer<typeof translateSchema>;
  try {
    const rawPayload = await parseJsonBodyWithLimit<unknown>(
      request,
      TRANSLATE_BODY_LIMIT_BYTES
    );
    payload = translateSchema.parse(rawPayload);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return apiError(413, "Translation payload exceeds size limit");
    }
    if (error instanceof InvalidJsonBodyError) {
      return apiError(400, "Invalid request body");
    }
    return apiError(400, "Invalid translation payload");
  }

  const sourceLanguage = mapToGoogleLanguageCode(payload.sourceLanguage);
  const targetLanguage = mapToGoogleLanguageCode(payload.targetLanguage);
  const texts = payload.texts.map((text) => text.trim());

  if (!sourceLanguage || !targetLanguage || texts.length === 0) {
    return apiError(400, "Missing required translation fields");
  }

  if (sourceLanguage === targetLanguage) {
    const successResponse: APIResponse = {
      data: {
        failedCount: 0,
        translations: texts,
      },
      success: true,
    };
    return NextResponse.json(successResponse);
  }

  try {
    let failedCount = 0;
    const uniqueTexts = Array.from(new Set(texts));
    const translationMap = new Map<string, string>();

    const batches = chunkArray(uniqueTexts, 8);
    for (const batch of batches) {
      const translatedBatch = await Promise.all(
        batch.map(async (sourceText) => {
          try {
            const translated = await translateText(
              sourceText,
              sourceLanguage,
              targetLanguage
            );
            return { failed: false, sourceText, translated };
          } catch {
            return { failed: true, sourceText, translated: sourceText };
          }
        })
      );

      translatedBatch.forEach((entry) => {
        if (entry.failed) {
          failedCount += 1;
        }
        translationMap.set(entry.sourceText, entry.translated);
      });
    }

    const translations = texts.map((text) => translationMap.get(text) || text);
    const successResponse: APIResponse = {
      data: {
        failedCount,
        translations,
      },
      success: true,
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("[translate] failed", error);
    return apiError(500, "Failed to translate text");
  }
}
