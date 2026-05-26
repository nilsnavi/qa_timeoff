export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network error') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function mapApiError(status: number, bodyText: string): ApiError {
  const fallback = bodyText || 'Request failed';

  try {
    const parsed = JSON.parse(bodyText) as {
      message?: string | string[];
      error?: string;
      statusCode?: number;
    };

    const message = Array.isArray(parsed.message)
      ? parsed.message.join('; ')
      : parsed.message || parsed.error || fallback;

    return new ApiError(message, parsed.statusCode ?? status, parsed);
  } catch {
    return new ApiError(fallback, status);
  }
}

