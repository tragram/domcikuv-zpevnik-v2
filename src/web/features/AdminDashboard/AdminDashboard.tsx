import { useSearch } from "@tanstack/react-router";
import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { AdminSidebar } from "./components/admin-sidebar";
import { IllustrationsTable } from "./components/illustrations-table/illustrations-table";
import SongsTable from "./components/songs-table";
import { UsersTable } from "./components/users-table";
import { AdminApi } from "~/services/songs";

interface AdminDashboardProps {
  adminApi: AdminApi;
}

export default function AdminDashboard({ adminApi }: AdminDashboardProps) {
  const { tab } = useSearch({ from: "/admin" });
  const [activeTab, setActiveTab] = useState(tab || "illustrations");
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
    <SidebarProvider>
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
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
        <div className="p-2 md:p-4 w-full">
          {activeTab === "songs" && <SongsTable adminApi={adminApi} />}
          {activeTab === "illustrations" && (
            <IllustrationsTable adminApi={adminApi} />
          )}
          {activeTab === "users" && <UsersTable adminApi={adminApi} />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
