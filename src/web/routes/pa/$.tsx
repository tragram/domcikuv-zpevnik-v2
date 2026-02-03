import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pa/$")({
  component: RouteComponent,
  loader: async ({ params }) => {
    // encodeURIComponent handles slashes within the splat
    const encodedSlug = encodeURIComponent(params._splat || "");

    const response = await fetch(`/api/songs/proxy/pa/${encodedSlug}`);

    if (!response.ok) {
      throw new Error("Failed to fetch lyrics");
    }

    const json = await response.json();
    return {
      html: json.data.html as string,
    };
  },
});

function RouteComponent() {
  const { html } = Route.useLoaderData();

  return (
    <div className="h-dvh w-dvw overflow-auto p-4 bg-white">
      {/* Render the HTML extracted by the backend */}
      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
