export class PlannerError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PlannerError";
  }
}

export function errorResult(error: unknown) {
  if (error instanceof PlannerError)
    return { code: error.code, message: error.message, ...error.details };
  return { code: "INTERNAL_ERROR", message: "처리 중 오류가 발생했습니다." };
}
