import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "~/features/AdminDashboard/AdminDashboard";
export const Route = createFileRoute("/admin")({
  component: Home,
  loader: async ({ context }) => {
    return context;
  },
  ssr: false,
});

function Home() {
  const { userData, songDB } = Route.useLoaderData();

  return <AdminDashboard />;
}
