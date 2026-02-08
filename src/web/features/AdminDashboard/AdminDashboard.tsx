import { useSearch, useNavigate } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import {
  SidebarContent,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { AdminSidebar } from "./components/admin-sidebar";
import { IllustrationsTable } from "./components/illustrations-table/illustrations-table";
import SongsTable from "./components/songs-table";
import { UsersTable } from "./components/users-table";
import { AdminApi } from "~/services/song-service";

interface AdminDashboardProps {
  adminApi: AdminApi;
}

export default function AdminDashboard({ adminApi }: AdminDashboardProps) {
  const { tab } = useSearch({ from: "/admin" });
  const navigate = useNavigate();
  const activeTab = tab || "songs";

  const setActiveTab = (newTab: string) => {
    navigate({
      to: "/admin",
      search: { tab: newTab },
    });
  };

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case "songs":
        return "Songs";
      case "illustrations":
        return "Illustrations";
      case "users":
        return "Users";
      default:
        return "Dashboard";
    }
  };

  return (
    <SidebarProvider className="h-screen">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <SidebarContent className="flex flex-col h-full">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b">
          <SidebarTrigger className="ml-2" />
          <Separator orientation="vertical" className="mr-2" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold">
                  Admin Dashboard - {getTabTitle(activeTab)}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex-1 p-2 md:p-4 overflow-auto">
          {activeTab === "songs" && <SongsTable adminApi={adminApi} />}
          {activeTab === "illustrations" && (
            <IllustrationsTable adminApi={adminApi} />
          )}
          {activeTab === "users" && <UsersTable adminApi={adminApi} />}
        </div>
      </SidebarContent>
    </SidebarProvider>
  );
}
