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
  const { songDBAdmin } = Route.useLoaderData();
  return <AdminDashboard songDB={songDBAdmin} />;
}
