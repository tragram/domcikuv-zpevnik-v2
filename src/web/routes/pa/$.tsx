import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pa/$")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const songDB = context.songDB;
    return {
      user: context.user,
      slug: params._splat,
      songDB,
    };
  },
});

function RouteComponent() {
  const { slug, user } = Route.useLoaderData();

  return (
    <div className="h-dvh w-dvw">
      <iframe
        src={`https://pisnicky-akordy.cz/${slug}`}
        width="100%"
        height="100%"
      ></iframe>
    </div>
  );
}
