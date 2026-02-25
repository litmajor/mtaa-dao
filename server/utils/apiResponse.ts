export const ApiResponse = {
  success<T>(data: T, meta: Record<string, unknown> = {}) {
    const response = {
      success: true as const,
      data,
      meta,
      addMeta(extra: Record<string, unknown>) {
        this.meta = { ...this.meta, ...extra };
        return this;
      },
    };

    return response;
  },

  error(message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500) {
    return {
      success: false as const,
      error: {
        code,
        message,
        statusCode,
      },
      meta: {
        timestamp: Date.now(),
      },
    };
  },
};
