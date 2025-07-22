import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "~/components/shadcn-ui/button"
import { Input } from "~/components/shadcn-ui/input"
import { Badge } from "~/components/shadcn-ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn-ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/shadcn-ui/dialog"
import { Label } from "~/components/shadcn-ui/label"
import { Switch } from "~/components/shadcn-ui/switch"
import { Plus, Edit, Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouteContext } from "@tanstack/react-router"
import { 
  fetchUsersAdmin, 
  createUserAdmin, 
  updateUserAdmin, 
  deleteUserAdmin 
} from "~/lib/users" // Adjust import path as needed
import { toast } from "sonner" // Assuming you're using sonner for toasts

interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string
  nickname?: string
  isTrusted: boolean
  isAdmin: boolean
  isFavoritesPublic: boolean
  createdAt: Date
  updatedAt: Date
  lastLogin: Date
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

interface UsersTableProps {
  initialUsers?: UsersResponse;
}

export function UsersTable({ initialUsers }: UsersTableProps) {
  const { api } = useRouteContext({ from: "/admin" })
  const queryClient = useQueryClient()
  
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(0)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  
  const pageSize = 20

  // Fetch users with search and pagination
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['users', searchTerm, currentPage],
    queryFn: () => fetchUsersAdmin(api.admin, {
      search: searchTerm || undefined,
      limit: pageSize,
      offset: currentPage * pageSize,
    }),
    initialData: currentPage === 0 && !searchTerm ? initialUsers : undefined,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (userData: Parameters<typeof createUserAdmin>[1]) => 
      createUserAdmin(api.admin, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully')
      setIsDialogOpen(false)
      setEditingUser(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create user')
    },
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, userData }: { userId: string; userData: Parameters<typeof updateUserAdmin>[2] }) =>
      updateUserAdmin(api.admin, userId, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated successfully')
      setIsDialogOpen(false)
      setEditingUser(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update user')
    },
  })

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => deleteUserAdmin(api.admin, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted successfully')
      setIsDeleteConfirmOpen(false)
      setUserToDelete(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete user')
    },
  })

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(0)
  }, [searchTerm])

  const handleSaveUser = (userData: Partial<User>) => {
    if (editingUser) {
      updateUserMutation.mutate({ 
        userId: editingUser.id, 
        userData 
      })
    } else {
      createUserMutation.mutate(userData as Parameters<typeof createUserAdmin>[1])
    }
  }

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user)
    setIsDeleteConfirmOpen(true)
  }

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id)
    }
  }

  const users = usersData?.users || []
  const totalPages = Math.ceil((usersData?.pagination.total || 0) / pageSize)
  const hasNextPage = usersData?.pagination.hasMore || false
  const hasPrevPage = currentPage > 0

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Users</h3>
        </div>
        <div className="text-center text-red-500 py-8">
          Failed to load users: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    )
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
            <UserForm 
              user={editingUser} 
              onSave={handleSaveUser}
              isLoading={createUserMutation.isPending || updateUserMutation.isPending}
            />
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
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
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1} to{' '}
            {Math.min((currentPage + 1) * pageSize, usersData?.pagination.total || 0)} of{' '}
            {usersData?.pagination.total || 0} users
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!hasNextPage}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Are you sure you want to delete user "{userToDelete?.name}"?</p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. All user data will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteUser}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserForm({ 
  user, 
  onSave, 
  isLoading 
}: { 
  user: User | null
  onSave: (data: Partial<User>) => void
  isLoading?: boolean
}) {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    nickname: user?.nickname || "",
    emailVerified: user?.emailVerified || false,
    isTrusted: user?.isTrusted || false,
    isAdmin: user?.isAdmin || false,
    isFavoritesPublic: user?.isFavoritesPublic || false,
  })

  // Update form data when user prop changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        nickname: user.nickname || "",
        emailVerified: user.emailVerified,
        isTrusted: user.isTrusted,
        isAdmin: user.isAdmin,
        isFavoritesPublic: user.isFavoritesPublic,
      })
    } else {
      setFormData({
        name: "",
        email: "",
        nickname: "",
        emailVerified: false,
        isTrusted: false,
        isAdmin: false,
        isFavoritesPublic: false,
      })
    }
  }, [user])

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
            disabled={isLoading}
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
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input
          id="nickname"
          value={formData.nickname}
          onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="emailVerified"
            checked={formData.emailVerified}
            onCheckedChange={(checked) => setFormData({ ...formData, emailVerified: checked })}
            disabled={isLoading}
          />
          <Label htmlFor="emailVerified">Email Verified</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isTrusted"
            checked={formData.isTrusted}
            onCheckedChange={(checked) => setFormData({ ...formData, isTrusted: checked })}
            disabled={isLoading}
          />
          <Label htmlFor="isTrusted">Trusted User</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isAdmin"
            checked={formData.isAdmin}
            onCheckedChange={(checked) => setFormData({ ...formData, isAdmin: checked })}
            disabled={isLoading}
          />
          <Label htmlFor="isAdmin">Admin</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isFavoritesPublic"
            checked={formData.isFavoritesPublic}
            onCheckedChange={(checked) => setFormData({ ...formData, isFavoritesPublic: checked })}
            disabled={isLoading}
          />
          <Label htmlFor="isFavoritesPublic">Public Favorites</Label>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (user ? "Updating..." : "Creating...") : (user ? "Update User" : "Create User")}
      </Button>
    </form>
  )
}