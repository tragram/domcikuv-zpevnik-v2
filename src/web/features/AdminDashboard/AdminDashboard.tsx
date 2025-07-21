import { useState } from "react";
import { AdminSidebar } from "./components/admin-sidebar";
import { UsersTable } from "./components/users-table";
import { IllustrationsTable } from "./components/illustrations-table";
import { ChangesTable } from "./components/changes-table";
import { SidebarProvider, SidebarInset } from "~/components/shadcn-ui/sidebar";
import { SongDB } from "~/types/types";
import SongsTable from "./components/songs-table";

interface SongIllustration {
  id: string;
  songId: string;
  songTitle: string;
  promptId: string;
  promptModel: string;
  imageModel: string;
  imageURL: string;
  thumbnailURL: string;
  isActive: boolean;
  createdAt: Date;
}

interface SongChange {
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
  illustrations: SongIllustration[];
  changes: SongChange[];
  users: UsersResponse;
}

export default function AdminDashboard({ 
  songDB, 
  illustrations, 
  changes, 
  users 
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("songs");

  const renderContent = () => {
    switch (activeTab) {
      case "songs":
        return <SongsTable songDB={songDB} />;
      case "illustrations":
        return <IllustrationsTable initialIllustrations={illustrations} />;
      case "changes":
        return <ChangesTable initialChanges={changes} />;
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