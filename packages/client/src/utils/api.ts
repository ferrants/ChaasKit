class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  headers?: Record<string, string>;
}

async function request<T>(
  url: string,
  options: RequestInit & ApiOptions = {}
): Promise<T> {
  const { headers, ...rest } = options;

  const response = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, error.error?.message || error.message, error.error?.code);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  get<T>(url: string, options?: ApiOptions): Promise<T> {
    return request<T>(url, { method: 'GET', ...options });
  },

  post<T>(url: string, data: unknown, options?: ApiOptions): Promise<T> {
    return request<T>(url, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    });
  },

  patch<T>(url: string, data: unknown, options?: ApiOptions): Promise<T> {
    return request<T>(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
      ...options,
    });
  },

  put<T>(url: string, data: unknown, options?: ApiOptions): Promise<T> {
    return request<T>(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    });
  },

  delete<T>(url: string, options?: ApiOptions): Promise<T> {
    return request<T>(url, { method: 'DELETE', ...options });
  },
};

export { ApiError };
