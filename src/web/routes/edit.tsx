import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/edit")({
  component: Layout,
});

function Layout() {
  return <Outlet />;
}
