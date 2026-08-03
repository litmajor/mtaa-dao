type ApiResponseBuilder<T> = {
  success: true;
  data: T;
  meta: Record<string, unknown>;
  addMeta(extra: Record<string, unknown>): ApiResponseBuilder<T>;
};

type ApiErrorBuilder = {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
  meta: Record<string, unknown>;
  addMeta(extra: Record<string, unknown>): ApiErrorBuilder;
};

export const ApiResponse = {
  success<T>(data: T, meta: Record<string, unknown> = {}): ApiResponseBuilder<T> {
    const response: ApiResponseBuilder<T> = {
      success: true,
      data,
      meta,
      addMeta(extra: Record<string, unknown>) {
        this.meta = { ...this.meta, ...extra };
        return this;
      },
    };

    return response;
  },

  error(message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500): ApiErrorBuilder {
    const response: ApiErrorBuilder = {
      success: false,
      error: {
        code,
        message,
        statusCode,
      },
      meta: {
        timestamp: Date.now(),
      },
      addMeta(extra: Record<string, unknown>) {
        this.meta = { ...this.meta, ...extra };
        return this;
      },
    };

    return response;
  },
};
