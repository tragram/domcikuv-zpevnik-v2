"use client";

import { Link } from "@tanstack/react-router";
import {
  Database,
  Home,
  ImageIcon,
  Music,
  Pencil,
  User,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "~/components/ui/sidebar";

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
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
    title: "Users",
    icon: Users,
    id: "users",
  },
];

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
            <span className="text-xs text-sidebar-foreground/70">
              Domčíkův Zpěvník
            </span>
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
              <SidebarSeparator />
              <SidebarGroupLabel>Site navigation</SidebarGroupLabel>
              <SidebarMenuItem key="Home">
                <Link to="/">
                  <SidebarMenuButton>
                    <Home className="size-4" /> Home
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem key="Editor">
                <Link to="/edit">
                  <SidebarMenuButton>
                    <Pencil className="size-4" /> Editor
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem key="Profile">
                <Link to="/profile">
                  <SidebarMenuButton>
                    <User className="size-4" /> Profile
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
