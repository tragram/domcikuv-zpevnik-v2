import { createFileRoute, Outlet } from "@tanstack/react-router";
import editorApp from "../../worker/api/editor";

export const Route = createFileRoute("/edit")({
  component: Layout,
  loader: () => ({
    editor: editorApp,
  }),
});

function Layout() {
  return <Outlet />;
}
