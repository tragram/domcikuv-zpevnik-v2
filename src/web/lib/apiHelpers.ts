export class ApiError extends Error {
  constructor(
    message: string, 
    public statusCode: number = 500, 
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const handleApiResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      error: `HTTP ${response.status}: ${response.statusText}` 
    }));
    throw new ApiError(
      errorData.error || 'Request failed', 
      response.status,
      errorData.code
    );
  }
  return response;
};

export const makeApiRequest = async <T>(
  apiCall: () => Promise<Response>,
  errorMessage: string
): Promise<T> => {
  try {
    const response = await apiCall();
    await handleApiResponse(response);
    return response.json();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    throw error;
  }
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}