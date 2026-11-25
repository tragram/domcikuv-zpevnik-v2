import { afterEach, expect, it, vi } from "vitest";
import { handleApiResponse } from "src/web/services/api-service";
import { SUMMARY_PROMPT_VERSIONS } from "src/lib/contracts/image-generation";
import { illustrationRoutes, trustedGenerateRoute } from "./illustrations";

vi.mock("../../helpers/song-helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../helpers/song-helpers")>()),
  getSongPopulated: async () => ({ id: "example-song" }),
}));

vi.mock("../../helpers/illustration-helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../helpers/illustration-helpers")>()),
  findOrCreatePrompt: async () => ({ id: "saved-prompt", text: "A painted forest" }),
  sameParametersExist: async () => false,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("queues an imported sheet revision with the same presets as a new song", async () => {
  const send = vi.fn();
  const presets = { summaryModel: "gpt-6-luna", imageModel: "gpt-image-2.6-flare" };
  const env = { ILLUSTRATION_QUEUE: { send }, KV: { get: async () => presets } };
  const queue = (versionId?: string) => trustedGenerateRoute.request("/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ songId: "example-song", versionId, setAsActive: true }),
  }, env);

  expect((await queue()).status).toBe(202);
  expect((await queue("revised-sheet")).status).toBe(202);
  const job = { songId: "example-song", setAsActive: true, promptVersion: SUMMARY_PROMPT_VERSIONS[0], ...presets };
  expect(send).toHaveBeenNthCalledWith(1, job);
  expect(send).toHaveBeenNthCalledWith(2, { ...job, versionId: "revised-sheet" });
});

it("passes the OpenAI moderation code to the admin client", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", async () =>
    Response.json(
      {
        error: {
          code: "moderation_blocked",
          type: "image_generation_user_error",
          message: "Internal moderation details",
        },
      },
      { status: 400 },
    ),
  );

  const response = await illustrationRoutes.request(
    "/generate",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        songId: "example-song",
        setAsActive: false,
        summaryModel: "gpt-6-luna",
        imageModel: "gpt-image-2.6-flare",
      }),
    },
    { OPENAI_API_KEY: "test-key" },
  );

  await expect(handleApiResponse(response)).rejects.toMatchObject({
    status: 400,
    code: "moderation_blocked",
    message: "OpenAI blocked the illustration (moderation_blocked)",
  });
});
