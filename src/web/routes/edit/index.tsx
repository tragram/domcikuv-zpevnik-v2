import { createFileRoute } from "@tanstack/react-router";
import Editor from "~/features/Editor/Editor";
export const Route = createFileRoute("/edit/")({
  component: Home,
});

function Home() {
  return <Editor />;
}
