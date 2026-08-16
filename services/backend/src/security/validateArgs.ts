import { ZodSchema, ZodError } from 'zod';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Validates untrusted LLM tool call arguments against a strict Zod schema.
 * Rejects any malformed or extra dangerous payload.
 */
export function validateToolArgs<T>(schema: ZodSchema<T>, rawArgs: unknown): ValidationResult<T> {
  try {
    const parsed = schema.parse(rawArgs);
    return {
      success: true,
      data: parsed,
    };
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldErrors = err.flatten().fieldErrors as Record<string, string[]>;
      const errorMessage = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return {
        success: false,
        error: `Tool argument schema validation failed: ${errorMessage}`,
        fieldErrors,
      };
    }
    return {
      success: false,
      error: `Unknown argument validation error: ${String(err)}`,
    };
  }
}
