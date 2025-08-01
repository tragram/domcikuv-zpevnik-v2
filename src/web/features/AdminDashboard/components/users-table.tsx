import type React from "react";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from '~/components/ui/input';
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { DeletePrompt } from "./shared/delete-prompt";
import { ActionButtons } from "./shared/action-buttons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Edit } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TableToolbar } from "./shared/table-toolbar";
import { Pagination } from "./shared/pagination";
import {
  deleteUserAdmin,
  updateUserAdmin,
} from "~/services/users";
import { toast } from "sonner";
import { useUsersAdmin } from "../hooks";
import { AdminApi } from "~/services/songs";

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

interface UsersTableProps {
  adminApi: AdminApi;
}

export function UsersTable({ adminApi }: UsersTableProps) {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const pageSize = 20;

  const {
    data: usersData,
    isLoading,
    error,
  } = useUsersAdmin(adminApi, {
    limit: pageSize,
    offset: currentPage * pageSize,
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({
      userId,
      userData,
    }: {
      userId: string;
      userData: Parameters<typeof updateUserAdmin>[2];
    }) => updateUserAdmin(adminApi.users, userId, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated successfully");
      setIsDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update user");
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => deleteUserAdmin(adminApi.users, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete user");
    },
  });

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm]);

  const handleSaveUser = (userData: Partial<User>) => {
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        userData,
      });
    }
  };

  const users = usersData?.users || [];
  const totalPages = Math.ceil((usersData?.pagination.total || 0) / pageSize);
  const hasNextPage = usersData?.pagination.hasMore || false;
  const hasPrevPage = currentPage > 0;

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Users</h3>
        </div>
        <div className="text-center text-red-500 py-8">
          Failed to load users:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TableToolbar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

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
              <TableHead>Last login</TableHead>
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
              users.map((user: User) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.nickname || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.emailVerified ? "default" : "secondary"}
                    >
                      {user.emailVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {user.isAdmin && (
                        <Badge variant="destructive">Admin</Badge>
                      )}
                      {user.isTrusted && (
                        <Badge variant="default">Trusted</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {new Date(user.lastLogin).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <ActionButtons>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingUser(user);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DeletePrompt
                        onDelete={() => deleteUserMutation.mutate(user.id)}
                        title={`Are you sure you want to delete user "${user.name}"?`}
                        description="This action cannot be undone. All user data will be permanently deleted."
                        variant="ghost"
                        size="sm"
                      />
                    </ActionButtons>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onPageChange={setCurrentPage}
          totalItems={usersData?.pagination.total || 0}
          pageSize={pageSize}
        />
      )}

      {/* Edit user dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <UserForm
            user={editingUser}
            onSave={handleSaveUser}
            isLoading={updateUserMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserForm({
  user,
  onSave,
  isLoading,
}: {
  user: User | null;
  onSave: (data: Partial<User>) => void;
  isLoading?: boolean;
}) {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    nickname: user?.nickname || "",
    emailVerified: user?.emailVerified || false,
    isTrusted: user?.isTrusted || false,
    isAdmin: user?.isAdmin || false,
    isFavoritesPublic: user?.isFavoritesPublic || false,
  });

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
      });
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

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
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
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
          onChange={(e) =>
            setFormData({ ...formData, nickname: e.target.value })
          }
          disabled={isLoading}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="emailVerified"
            checked={formData.emailVerified}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, emailVerified: checked })
            }
            disabled={isLoading}
          />
          <Label htmlFor="emailVerified">Email Verified</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isTrusted"
            checked={formData.isTrusted}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, isTrusted: checked })
            }
            disabled={isLoading}
          />
          <Label htmlFor="isTrusted">Trusted User</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isAdmin"
            checked={formData.isAdmin}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, isAdmin: checked })
            }
            disabled={isLoading}
          />
          <Label htmlFor="isAdmin">Admin</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isFavoritesPublic"
            checked={formData.isFavoritesPublic}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, isFavoritesPublic: checked })
            }
            disabled={isLoading}
          />
          <Label htmlFor="isFavoritesPublic">Public Favorites</Label>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Updating..." : "Update User"}
      </Button>
    </form>
  );
}
