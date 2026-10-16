import { z, type ZodType } from "zod";
import { fromZod } from "./errors";

/**
 * Validate unknown input against a Zod schema, throwing a 400 AppError.
 * Returns the schema's *output* type, so fields with `.default()` are non-optional.
 */
export function parse<S extends ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw fromZod(result.error);
  return result.data as z.output<S>;
}
