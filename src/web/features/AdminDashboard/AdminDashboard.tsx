import { useState } from "react";
import { AdminSidebar } from "./components/admin-sidebar";
import { UsersTable } from "./components/users-table";
import { VersionsTable } from "./components/versions-table";
import { SidebarProvider, SidebarInset } from "~/components/shadcn-ui/sidebar";
import { SongDB } from "~/types/types";
import SongsTable from "./components/songs-table";
import { IllustrationApiResponse } from "src/worker/api/admin/illustrations";
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
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">
              Admin Dashboard
            </h2>
          </div>
          {renderContent()}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
