import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type { ZodError } from "zod";

/** Application error with an HTTP status and stable machine code. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, "bad_request", message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError(401, "unauthorized", message);
  }
  static forbidden(message = "Forbidden") {
    return new AppError(403, "forbidden", message);
  }
  static notFound(message = "Not found") {
    return new AppError(404, "not_found", message);
  }
}

/** Convert a Zod error into a 400 AppError with field-level details. */
export function fromZod(err: ZodError): AppError {
  return AppError.badRequest(
    "Validation failed",
    err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

export function registerErrorHandler(app: {
  setErrorHandler: (
    handler: (err: FastifyError | AppError, req: FastifyRequest, reply: FastifyReply) => void,
  ) => void;
  log: { error: (obj: unknown, msg?: string) => void };
}): void {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      void reply.code(err.status).send({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    req.log.error({ err }, "Unhandled error");
    void reply.code(500).send({
      error: { code: "internal_error", message: "Internal server error" },
    });
  });
}
