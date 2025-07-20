
import { useState } from "react"
import { AdminSidebar } from "./components/admin-sidebar"
import { UsersTable } from "./components/users-table"
import { SongsTable } from "./components/songs-table"
import { IllustrationsTable } from "./components/illustrations-table"
import { ChangesTable } from "./components/changes-table"
import { SidebarProvider, SidebarInset } from "~/components/shadcn-ui/sidebar"

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("users")

  const renderContent = () => {
    switch (activeTab) {
      case "users":
        return <UsersTable />
      case "songs":
        return <SongsTable />
      case "illustrations":
        return <IllustrationsTable />
      case "changes":
        return <ChangesTable />
      default:
        return <UsersTable />
    }
  }

  return (
    <SidebarProvider>
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <SidebarInset>
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
          </div>
          {renderContent()}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
