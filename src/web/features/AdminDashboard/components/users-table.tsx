import type React from "react";

import { useState, useEffect, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ActionButtons } from "./shared/action-buttons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Edit, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableToolbar } from "./shared/table-toolbar";
import { Pagination } from "./shared/pagination";
import { toast } from "sonner";
import { useUsersAdmin, useUpdateUser, useDeleteUser } from "../../../services/adminHooks";
import { AdminApi } from "~/services/song-service";
import DeletePrompt from "../../../components/dialogs/delete-prompt";
import { UserDB } from "src/lib/db/schema";

interface UsersTableProps {
  adminApi: AdminApi;
}

const PAGE_SIZE = 20;

type SortConfig = {
  key: keyof UserDB;
  direction: "ascending" | "descending";
};

export function UsersTable({ adminApi }: UsersTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [editingUser, setEditingUser] = useState<UserDB | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const {
    data: usersData,
    isLoading,
    error,
  } = useUsersAdmin(adminApi, {
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
    search: searchTerm || undefined,
  });

  const updateUserMutation = useUpdateUser(adminApi);
  const deleteUserMutation = useDeleteUser(adminApi);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm]);

  const users = usersData?.users || [];

  const sortedUsers = useMemo(() => {
    const sortableUsers = [...users];
    if (sortConfig !== null) {
      sortableUsers.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableUsers;
  }, [users, sortConfig]);

  const requestSort = (key: keyof UserDB) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof UserDB) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    }
    return sortConfig.direction === "ascending" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const handleSaveUser = (userData: Partial<UserDB>) => {
    if (editingUser) {
      updateUserMutation.mutate(
        { userId: editingUser.id, userData },
        {
          onSuccess: () => {
            toast.success("User updated successfully");
            setIsDialogOpen(false);
            setEditingUser(null);
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to update user");
          },
        },
      );
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    deleteUserMutation.mutate(userId, {
      onSuccess: () => {
        toast.success(`User "${userName}" deleted successfully`);
      },
      onError: (error: Error) => {
        toast.error(error.message || "Failed to delete user");
      },
    });
  };

  const totalPages = Math.ceil((usersData?.pagination.total || 0) / PAGE_SIZE);
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

  const renderHeader = (label: string, key: keyof UserDB) => (
    <TableHead onClick={() => requestSort(key)} className="cursor-pointer">
      <div className="flex items-center">
        {label}
        {getSortIndicator(key)}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <TableToolbar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {renderHeader("Name", "name")}
              {renderHeader("Email", "email")}
              {renderHeader("Nickname", "nickname")}
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              {renderHeader("Created", "createdAt")}
              {renderHeader("Last login", "lastLogin")}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => (
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
                        onDelete={() => handleDeleteUser(user.id, user.name)}
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
          pageSize={PAGE_SIZE}
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
  user: UserDB | null;
  onSave: (data: Partial<UserDB>) => void;
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
