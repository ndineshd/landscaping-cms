/**
 * POST /api/translate
 * Uses Google Translate to translate text batches for CMS language onboarding.
 */

import { NextRequest, NextResponse } from "next/server";
import type { APIResponse } from "@/types/cms";

const GOOGLE_TRANSLATE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";
const GOOGLE_LANGUAGE_CODE_MAP: Record<string, string> = {
  tel: "te",
};

interface TranslatePayload {
  password: string;
  sourceLanguage: string;
  targetLanguage: string;
  texts: string[];
}

function normalizeLanguageCode(code: string): string {
  return code.trim().toLowerCase();
}

function mapToGoogleLanguageCode(code: string): string {
  const normalized = normalizeLanguageCode(code);
  return GOOGLE_LANGUAGE_CODE_MAP[normalized] || normalized;
}

function validatePassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD environment variable not set");
    return false;
  }
  return password === adminPassword;
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
    sl: sourceLanguage,
    tl: targetLanguage,
    dt: "t",
    q: text,
  });

  const response = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Translate request failed with status ${response.status}`);
  }

  const parsed = (await response.json()) as unknown;
  const translated = parseGoogleTranslateResponse(parsed);
  return translated ?? text;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let payload: TranslatePayload;
    try {
      payload = (await request.json()) as TranslatePayload;
    } catch {
      const response: APIResponse = {
        success: false,
        error: "Invalid request body",
        status: 400,
      };
      return NextResponse.json(response, { status: 400 });
    }

    const sourceLanguage = mapToGoogleLanguageCode(payload.sourceLanguage || "");
    const targetLanguage = mapToGoogleLanguageCode(payload.targetLanguage || "");
    const texts = Array.isArray(payload.texts)
      ? payload.texts.filter((text): text is string => typeof text === "string")
      : [];

    if (!payload.password || !sourceLanguage || !targetLanguage || texts.length === 0) {
      const response: APIResponse = {
        success: false,
        error: "Missing required fields: password, sourceLanguage, targetLanguage, texts",
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

    if (sourceLanguage === targetLanguage) {
      const successResponse: APIResponse = {
        success: true,
        data: {
          translations: texts,
          failedCount: 0,
        },
      };
      return NextResponse.json(successResponse);
    }

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
            return { sourceText, translated, failed: false };
          } catch {
            return { sourceText, translated: sourceText, failed: true };
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
      success: true,
      data: {
        translations,
        failedCount,
      },
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
