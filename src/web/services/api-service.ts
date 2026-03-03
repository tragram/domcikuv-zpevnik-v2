export class ApiException extends Error {
  status: number;
  code?: number | string;
  data?: unknown;

  constructor(
    message: string,
    status: number,
    code?: number | string,
    data?: unknown,
  ) {
    super(message);
    this.name = "ApiException";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// Extract the data type from a JSend success response
type ExtractJSendData<T> = T extends { status: string; data: infer U }
  ? U
  : T extends { data: infer U }
    ? U
    : never;

// Define the expected JSend structure for type guarding
interface JSendParsed {
  status: string;
  data?: unknown;
  failData?: {
    message?: string;
    code?: string | number;
  };
  message?: string;
  code?: string | number;
  errorData?: unknown;
}

// create a structural interface that matches BOTH standard Response and Hono ClientResponse
export interface BaseResponse {
  status: number;
  json(): Promise<unknown>;
}

export async function handleApiResponse<T>(
  response: BaseResponse,
): Promise<ExtractJSendData<T>> {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApiException("Invalid JSON from server", response.status);
  }

  const isJSend = (obj: unknown): obj is JSendParsed => {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "status" in obj &&
      typeof (obj as Record<string, unknown>).status === "string"
    );
  };

  if (!isJSend(json)) {
    throw new ApiException("Invalid JSend response structure", response.status);
  }

  if (json.status === "success") {
    return json.data as ExtractJSendData<T>;
  }

  if (json.status === "fail") {
    throw new ApiException(
      json.failData?.message ?? "Request failed",
      response.status,
      json.failData?.code,
      json.failData,
    );
  }

  if (json.status === "error") {
    const message =
      typeof json.message === "string" ? json.message : "Unknown error";
    throw new ApiException(message, response.status, json.code, json.errorData);
  }

  throw new ApiException("Unknown JSend status", response.status);
}

export const makeApiRequest = async <
  T extends () => Promise<BaseResponse>,
  U = T extends () => Promise<{ json(): Promise<infer R> }> ? R : never,
>(
  apiCall: T,
  errorMessage?: string,
): Promise<ExtractJSendData<U>> => {
  try {
    const response = await apiCall();
    return await handleApiResponse<U>(response);
  } catch (error) {
    if (errorMessage) console.error(`${errorMessage}:`, error);
    throw error;
  }
};
