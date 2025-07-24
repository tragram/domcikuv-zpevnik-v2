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
  SidebarRail,
} from "~/components/shadcn-ui/sidebar"

interface AdminSidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const menuItems = [
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
    title: "Versions",
    icon: History,
    id: "versions",
  },
  {
    title: "Users",
    icon: Users,
    id: "users",
  },
]

export function AdminSidebar({ activeTab, setActiveTab }: AdminSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground bg-primary">
            <Database className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-semibold">Admin Panel</span>
            <span className="text-xs text-sidebar-foreground/70">Domčíkův Zpěvník</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Database Tables</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveTab(item.id)}
                    isActive={activeTab === item.id}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
