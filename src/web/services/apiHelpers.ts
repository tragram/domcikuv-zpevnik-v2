import type { InferResponseType } from "hono/client";

export class ApiException extends Error {
  status: number;
  code?: number;
  data?: any;

  constructor(message: string, status: number, code?: number, data?: any) {
    super(message);
    this.name = "ApiException";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// Extract the data type from a JSend success response
// Handle the case where status is inferred as string rather than literal "success"
type ExtractJSendData<T> = T extends { status: string; data: infer U } 
  ? U 
  : T extends { data: infer U }
  ? U
  : never;

export async function handleApiResponse<T>(response: Response): Promise<ExtractJSendData<T>> {
  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new ApiException("Invalid JSON from server", response.status);
  }

  if (!json || typeof json.status !== "string") {
    throw new ApiException("Invalid JSend response structure", response.status);
  }

  if (json.status === "success") {
    return json.data as ExtractJSendData<T>;
  }

  if (json.status === "fail") {
    throw new ApiException(
      "Request failed",
      response.status,
      undefined,
      json.data
    );
  }

  if (json.status === "error") {
    const message =
      typeof json.message === "string" ? json.message : "Unknown error";
    throw new ApiException(message, response.status, json.code, json.data);
  }

  throw new ApiException("Unknown JSend status", response.status);
}

// Define what a Hono client API function looks like
type HonoApiFunction = (...args: any[]) => Promise<Response>;

export const makeApiRequest = async <T extends HonoApiFunction>(
  apiCall: T,
  errorMessage?: string
): Promise<ExtractJSendData<InferResponseType<T>>> => {
  try {
    const response = await apiCall();
    return await handleApiResponse<InferResponseType<T>>(response);
  } catch (error) {
    if (errorMessage) console.error(`${errorMessage}:`, error);
    throw error;
  }
};