import { useState } from "react";
import {
  IllustrationPromptDB,
  SongDataDB,
  SongIllustrationDB,
  SongVersionDB,
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
import { useQuery } from "@tanstack/react-query";
import { UsersResponse } from "src/worker/api/admin/users";
import {
  fetchIllustrationsAdmin,
  fetchPromptsAdmin,
  getSongsAdmin,
  AdminApi,
  getVersionsAdmin,
  putSongAdmin,
  putVersionAdmin,
  deleteVersionAdmin,
  setCurrentVersionAdmin,
  resetVersionDB,
  songsWithCurrentVersionAdmin,
} from "~/services/songs";
import { fetchUsersAdmin } from "~/services/users";

interface AdminDashboardProps {
  adminApi: AdminApi;
}

export default function AdminDashboard({ adminApi }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("illustrations");
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

  const { data: songs } = useQuery({
    queryKey: ["songsAdmin"],
    queryFn: () => getSongsAdmin(adminApi),
    staleTime: 1000 * 60 * 60, // minute
  });

  const { data: songDBAdmin } = useQuery({
    queryKey: ["songDBAdmin"],
    queryFn: () => songsWithCurrentVersionAdmin(adminApi),
    staleTime: 1000 * 60 * 60, // minute
  });

  const { data: illustrations } = useQuery({
    queryKey: ["illustrationsAdmin"],
    queryFn: () => fetchIllustrationsAdmin(adminApi),
    staleTime: 1000 * 60 * 60,
  });
  const { data: prompts } = useQuery({
    queryKey: ["promptsAdmin"],
    queryFn: () => fetchPromptsAdmin(adminApi),
    staleTime: 1000 * 60 * 60,
  });

  const { data: versions } = useQuery({
    queryKey: ["versionsAdmin"],
    queryFn: () => getVersionsAdmin(adminApi),
    staleTime: 1000 * 60 * 60,
  });

  const { data: users } = useQuery({
    queryKey: ["usersAdmin"],
    queryFn: () => fetchUsersAdmin(adminApi.users, { limit: 20, offset: 0 }),
    staleTime: 1000 * 60 * 60,
  });

  const renderContent = (
    songs?: SongDataDB[],
    illustrations?: SongIllustrationDB[],
    prompts?: IllustrationPromptDB[],
    versions?: SongVersionDB[],
    users?: UsersResponse
  ) => {
    switch (activeTab) {
      case "songs":
        return songs ? (
          <SongsTable
            songs={songs}
            versions={versions}
            songService={{
              updateSong: putSongAdmin,
              resetDB: resetVersionDB,
            }}
            versionService={{
              updateVersion: putVersionAdmin,
              deleteVersion: deleteVersionAdmin,
              setCurrentVersion: setCurrentVersionAdmin,
            }}
          />
        ) : (
          "Loading..."
        );
      case "illustrations":
        return illustrations && prompts && songs ? (
          <IllustrationsTable
            illustrations={illustrations}
            prompts={prompts}
            songs={songDBAdmin}
          />
        ) : (
          "Loading..."
        );
      case "users":
        return users ? <UsersTable initialUsers={users} /> : "Loading...";
      default:
        return "Unknown table...";
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
        {
          <div className="p-2 md:p-4 w-full">
            {renderContent(songs, illustrations, prompts, versions, users)}
          </div>
        }
      </SidebarInset>
    </SidebarProvider>
  );
}
