"use client"

import { Users, Music, ImageIcon, History, Database } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "~/components/shadcn-ui/sidebar"

interface AdminSidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const menuItems = [
  {
    title: "Users",
    icon: Users,
    id: "users",
  },
  {
    title: "Songs",
    icon: Music,
    id: "songs",
  },
  {
    title: "Illustrations",
    icon: ImageIcon,
    id: "illustrations",
  },
  {
    title: "Changes",
    icon: History,
    id: "changes",
  },
]

export function AdminSidebar({ activeTab, setActiveTab }: AdminSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <Database className="h-6 w-6" />
          <span className="font-semibold">Song DB Admin</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Database Tables</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton onClick={() => setActiveTab(item.id)} isActive={activeTab === item.id}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
