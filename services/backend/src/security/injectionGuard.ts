/**
 * Sanitizes and encapsulates untrusted external content (emails, webpages, external messages)
 * to prevent prompt injection and tool-call hijacking.
 */
export class PromptInjectionGuard {
  // Regex patterns that look like attempts to fake system instructions or tool calls
  private static readonly SUSPICIOUS_PATTERNS = [
    /<\/?system>/gi,
    /<\/?instruction>/gi,
    /<\/?tools?>/gi,
    /\[tool_call:/gi,
    /`{3,}(?:json)?\s*\{[\s\S]*?"tool_call"/gi,
    /IGNORE PREVIOUS INSTRUCTIONS/gi,
    /DISREGARD (?:ALL )?PRIOR/gi,
    /YOU ARE NOW IN (?:DEVELOPER|ADMIN|JAILBREAK) MODE/gi,
  ];

  /**
   * Cleans suspicious injection delimiters from raw text.
   */
  public static sanitize(rawText: string): string {
    if (typeof rawText !== 'string') return String(rawText);

    let sanitized = rawText;
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => `[SANITIZED: ${match}]`);
    }
    return sanitized;
  }

  /**
   * Wraps untrusted external content with defensive structural tags.
   */
  public static wrapUntrusted(source: string, content: unknown): string {
    const rawString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const sanitized = this.sanitize(rawString);

    return `<untrusted_external_content source="${source}">\n${sanitized}\n</untrusted_external_content>`;
  }

  /**
   * Sanitizes structured objects before adding them to model context.
   */
  public static wrapToolOutput(toolName: string, output: unknown): string {
    return this.wrapUntrusted(toolName, output);
  }
}
