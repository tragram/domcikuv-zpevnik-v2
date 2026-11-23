import { afterEach, expect, it, vi } from "vitest";
import { ImageGenerator } from "./image-generator";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("logs the OpenAI image error with credentials redacted and propagates it", async () => {
  const apiKey = "test-key";
  const model = "gpt-image-2.6-flare";
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", async () =>
    Response.json(
      {
        error: {
          message: `Key ${apiKey} cannot access this model.`,
          type: "invalid_request_error",
          code: "model_not_found",
          param: "model",
        },
      },
      { status: 404, headers: { "x-request-id": "req_image" } },
    ),
  );
  const generator = new ImageGenerator({
    imageModel: model,
    openaiApiKey: apiKey,
    promptVersion: "v7",
    summaryModel: "gpt-6-luna",
  });

  await expect(generator.generateImage("A painted forest")).rejects.toMatchObject({
    status: 404,
    code: "model_not_found",
  });
  expect(log).toHaveBeenCalledWith({
    event: "openai_image_generation_failed",
    model,
    status: 404,
    code: "model_not_found",
    type: "invalid_request_error",
    param: "model",
    requestId: "req_image",
    message: "404 Key [redacted API key] cannot access this model.",
  });
});
