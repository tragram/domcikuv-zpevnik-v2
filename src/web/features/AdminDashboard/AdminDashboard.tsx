"use client";

import { useState } from "react";
import { AdminSidebar } from "./components/admin-sidebar";
import { UsersTable } from "./components/users-table";
import { VersionsTable } from "./components/versions-table";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "~/components/shadcn-ui/sidebar";
import { Separator } from "~/components/shadcn-ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/shadcn-ui/breadcrumb";
import type { SongDB } from "~/types/types";
import SongsTable from "./components/songs-table";
import type { IllustrationApiResponse } from "src/worker/api/admin/illustrations";
import { IllustrationsTable } from "./components/illustrations-table/illustrations-table";

interface SongVersion {
  id: string;
  songId: string;
  songTitle: string;
  userId: string;
  userName: string;
  timestamp: Date;
  chordproURL: string;
  verified: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  nickname?: string;
  isTrusted: boolean;
  isAdmin: boolean;
  isFavoritesPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date;
}

interface UsersResponse {
  users: User[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface AdminDashboardProps {
  songDB: SongDB;
  illustrations: IllustrationApiResponse[];
  versions: SongVersion[];
  users: UsersResponse;
}

export default function AdminDashboard({
  songDB,
  illustrations,
  versions,
  users,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("illustrations");

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case "songs":
        return "Songs";
      case "illustrations":
        return "Illustrations";
      case "versions":
        return "Versions";
      case "users":
        return "Users";
      default:
        return "Dashboard";
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "songs":
        return <SongsTable songDB={songDB} />;
      case "illustrations":
        return <IllustrationsTable illustrations={illustrations} />;
      case "versions":
        return <VersionsTable initialVersions={versions} />;
      case "users":
        return <UsersTable initialUsers={users} />;
      default:
        return <SongsTable songDB={songDB} />;
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
        <div className="p-2 md:p-4 w-full">{renderContent()}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
