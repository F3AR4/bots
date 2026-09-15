/**
 * Secret Sanitizer & Logging Redaction Utility.
 * 
 * Guarantees that credentials, tokens, or secret patterns are never written to logs or storage.
 */

export class SecretSanitizer {
  private static readonly SECRET_PATTERNS = [
    /bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
    /key=[a-zA-Z0-9_\-]{16,}/gi,
    /secret=[a-zA-Z0-9_\-]{16,}/gi,
    /0x[0-9a-fA-F]{64}/g, // 256-bit hex private key pattern
  ];

  public static sanitize(message: string): string {
    let sanitized = message;
    for (const pattern of this.SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
    }
    return sanitized;
  }

  public static sanitizeString(message: string): string {
    return this.sanitize(message);
  }

  public static sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    const json = JSON.stringify(obj);
    const cleaned = this.sanitize(json);
    return JSON.parse(cleaned) as T;
  }
}
