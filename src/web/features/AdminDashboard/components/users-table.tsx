"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "~/components/shadcn-ui/button"
import { Input } from "~/components/shadcn-ui/input"
import { Badge } from "~/components/shadcn-ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn-ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/shadcn-ui/dialog"
import { Label } from "~/components/shadcn-ui/label"
import { Switch } from "~/components/shadcn-ui/switch"
import { Plus, Edit, Search } from "lucide-react"

interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  nickname?: string
  isTrusted: boolean
  isAdmin: boolean
  isFavoritesPublic: boolean
  createdAt: Date
  lastLogin: Date
}

const mockUsers: User[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    emailVerified: true,
    nickname: "johnny",
    isTrusted: true,
    isAdmin: true,
    isFavoritesPublic: false,
    createdAt: new Date("2024-01-15"),
    lastLogin: new Date("2024-01-20"),
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    emailVerified: true,
    nickname: "janes",
    isTrusted: false,
    isAdmin: false,
    isFavoritesPublic: true,
    createdAt: new Date("2024-01-10"),
    lastLogin: new Date("2024-01-19"),
  },
  {
    id: "3",
    name: "Bob Wilson",
    email: "bob@example.com",
    emailVerified: false,
    nickname: "bobby",
    isTrusted: false,
    isAdmin: false,
    isFavoritesPublic: false,
    createdAt: new Date("2024-01-12"),
    lastLogin: new Date("2024-01-18"),
  },
]

export function UsersTable() {
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSaveUser = (userData: Partial<User>) => {
    if (editingUser) {
      setUsers(users.map((user) => (user.id === editingUser.id ? { ...user, ...userData } : user)))
    } else {
      const newUser: User = {
        id: Date.now().toString(),
        name: userData.name || "",
        email: userData.email || "",
        emailVerified: userData.emailVerified || false,
        nickname: userData.nickname,
        isTrusted: userData.isTrusted || false,
        isAdmin: userData.isAdmin || false,
        isFavoritesPublic: userData.isFavoritesPublic || false,
        createdAt: new Date(),
        lastLogin: new Date(),
      }
      setUsers([...users, newUser])
    }
    setIsDialogOpen(false)
    setEditingUser(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Users</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingUser(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            </DialogHeader>
            <UserForm user={editingUser} onSave={handleSaveUser} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Nickname</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.nickname || "-"}</TableCell>
                <TableCell>
                  <Badge variant={user.emailVerified ? "default" : "secondary"}>
                    {user.emailVerified ? "Verified" : "Unverified"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {user.isAdmin && <Badge variant="destructive">Admin</Badge>}
                    {user.isTrusted && <Badge variant="default">Trusted</Badge>}
                  </div>
                </TableCell>
                <TableCell>{user.createdAt.toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingUser(user)
                      setIsDialogOpen(true)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function UserForm({ user, onSave }: { user: User | null; onSave: (data: Partial<User>) => void }) {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    nickname: user?.nickname || "",
    emailVerified: user?.emailVerified || false,
    isTrusted: user?.isTrusted || false,
    isAdmin: user?.isAdmin || false,
    isFavoritesPublic: user?.isFavoritesPublic || false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input
          id="nickname"
          value={formData.nickname}
          onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="emailVerified"
            checked={formData.emailVerified}
            onCheckedChange={(checked) => setFormData({ ...formData, emailVerified: checked })}
          />
          <Label htmlFor="emailVerified">Email Verified</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isTrusted"
            checked={formData.isTrusted}
            onCheckedChange={(checked) => setFormData({ ...formData, isTrusted: checked })}
          />
          <Label htmlFor="isTrusted">Trusted User</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isAdmin"
            checked={formData.isAdmin}
            onCheckedChange={(checked) => setFormData({ ...formData, isAdmin: checked })}
          />
          <Label htmlFor="isAdmin">Admin</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isFavoritesPublic"
            checked={formData.isFavoritesPublic}
            onCheckedChange={(checked) => setFormData({ ...formData, isFavoritesPublic: checked })}
          />
          <Label htmlFor="isFavoritesPublic">Public Favorites</Label>
        </div>
      </div>

      <Button type="submit" className="w-full">
        {user ? "Update User" : "Create User"}
      </Button>
    </form>
  )
}
