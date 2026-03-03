const MAX_CUSTOM_CSS_CHARS = 10_000;
const DANGEROUS_CSS_PATTERNS = [
  /<\/style/gi,
  /expression\s*\(/gi,
  /javascript:/gi,
  /@import/gi,
  /-moz-binding/gi,
  /behavior\s*:/gi,
  /data:text\/html/gi,
];

export function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => {
    switch (char) {
      case "<":
        return "\\u003C";
      case ">":
        return "\\u003E";
      case "&":
        return "\\u0026";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return char;
    }
  });
}

export function sanitizeCustomCss(css: string | undefined): string {
  if (!css) return "";
  const normalized = css.replace(/\u0000/g, "").trim();
  if (!normalized) return "";
  if (normalized.length > MAX_CUSTOM_CSS_CHARS) {
    return "";
  }
  if (DANGEROUS_CSS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "";
  }
  if (normalized.includes("<") || normalized.includes(">")) {
    return "";
  }
  return normalized;
}

export function isCustomCssEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return (process.env.ENABLE_ADMIN_CUSTOM_CSS || "").trim().toLowerCase() === "true";
}
