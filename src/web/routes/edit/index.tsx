import { createFileRoute } from "@tanstack/react-router";
import Editor from "~/features/Editor/Editor";
export const Route = createFileRoute("/edit/")({
  component: Home,
  loader: async ({ context }) => context,
});

function Home() {
  const { userData, songDB } = Route.useLoaderData();
  return <Editor songDB={songDB} />;
}
