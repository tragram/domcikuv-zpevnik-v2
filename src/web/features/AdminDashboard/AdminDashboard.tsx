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

interface AdminDashboardProps {
  songDB: SongDB;
  illustrations: SongIllustration[];
}

export default function AdminDashboard({ songDB, illustrations }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("songs");

  const renderContent = () => {
    switch (activeTab) {
      case "songs":
        return <SongsTable songDB={songDB} />;
      case "illustrations":
        return <IllustrationsTable initialIllustrations={illustrations} />;
      case "changes":
        return <ChangesTable />;
      case "users":
        return <UsersTable />;
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