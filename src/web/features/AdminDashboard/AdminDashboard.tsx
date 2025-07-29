import { useState } from "react";
import {
  IllustrationPromptDB,
  SongDataDB,
  SongIllustrationDB,
} from "src/lib/db/schema";
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
import { VersionsTable } from "./components/versions-table";
import { UsersResponse } from "src/worker/api/admin/users";
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

interface AdminDashboardProps {
  songs: SongDataDB[];
  illustrations: SongIllustrationDB[];
  prompts: IllustrationPromptDB[];
  versions: SongVersion[];
  users: UsersResponse;
}

export default function AdminDashboard({
  songs,
  illustrations,
  prompts,
  versions,
  users,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("users");
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
        return <SongsTable songData={songs} />;
      case "illustrations":
        return (
          <IllustrationsTable
            illustrations={illustrations}
            prompts={prompts}
            songs={songs}
          />
        );
      case "versions":
        return <VersionsTable initialVersions={versions} />;
      case "users":
        return <UsersTable initialUsers={users} />;
      default:
        return <SongsTable songData={songs} />;
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
