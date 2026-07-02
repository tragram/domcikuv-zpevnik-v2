import type React from "react";
import { useState, useMemo } from "react";
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
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Edit,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users as UsersIcon,
  Shield,
  ShieldCheck,
  BadgeCheck,
  KeyRound,
} from "lucide-react";
import { ControlPanel } from "./control-panel";
import { StatsBar } from "./stats-bar";
import { Pagination } from "./shared/pagination";
import { toast } from "sonner";
import {
  useUsersAdmin,
  useUpdateUser,
  useDeleteUser,
  useSetUserPassword,
} from "../../../services/admin-hooks";
import { AdminApi} from "~/../worker/api-client";
import DeletePrompt from "../../../components/dialogs/delete-prompt";
import { UserDB } from "src/lib/db/schema";
import type { UserRoleFilter } from "src/worker/helpers/user-helpers";

interface UsersTableProps {
  adminApi: AdminApi;
}
const PAGE_SIZE = 20;
type SortConfig = { key: keyof UserDB; direction: "ascending" | "descending" };

export function UsersTable({ adminApi }: UsersTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter | null>(null);
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
    role: roleFilter ?? undefined,
  });

  // Clicking an active stat card clears the filter; clicking another switches.
  const toggleRole = (role: UserRoleFilter | null) => {
    setRoleFilter((cur) => (cur === role ? null : role));
    setCurrentPage(0);
  };

  const updateUserMutation = useUpdateUser(adminApi);
  const deleteUserMutation = useDeleteUser(adminApi);

  // Search changes reset to the first page so matches aren't hidden off-page.
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(0);
  };

  const users = useMemo(() => usersData?.users ?? [], [usersData]);
  const sortedUsers = useMemo(() => {
    const sortableUsers = [...users];
    if (sortConfig !== null) {
      sortableUsers.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return sortableUsers;
  }, [users, sortConfig]);

  const requestSort = (key: keyof UserDB) => {
    setSortConfig({
      key,
      direction:
        sortConfig?.key === key && sortConfig.direction === "ascending"
          ? "descending"
          : "ascending",
    });
  };

  const renderHeader = (label: string, key: keyof UserDB) => (
    <TableHead
      onClick={() => requestSort(key)}
      className="cursor-pointer whitespace-nowrap hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center">
        {label}
        {!sortConfig || sortConfig.key !== key ? (
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
        ) : sortConfig.direction === "ascending" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  const totalPages = Math.ceil((usersData?.pagination.total || 0) / PAGE_SIZE);

  if (error) {
    return (
      <div className="space-y-4 p-8 text-center border-2 border-dashed border-red-200 bg-red-50 rounded-xl">
        <h3 className="text-lg font-bold text-red-600">Failed to load users</h3>
        <p className="text-red-500">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex flex-col sm:flex-row items-end justify-between border-b pb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center">
            <UsersIcon className="w-8 h-8 mr-3 text-primary" /> User Directory
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage {usersData?.counts?.total ?? 0} registered accounts and
            permissions.
          </p>
        </div>
      </div>

      <ControlPanel
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        className="border"
        header={
          <StatsBar
            items={[
              {
                label: "Users",
                value: usersData?.counts?.total ?? 0,
                icon: UsersIcon,
                onClick: () => toggleRole(null),
                active: roleFilter === null,
              },
              {
                label: "Admins",
                value: usersData?.counts?.admins ?? 0,
                icon: Shield,
                className: "text-primary",
                onClick: () => toggleRole("admin"),
                active: roleFilter === "admin",
              },
              {
                label: "Trusted",
                value: usersData?.counts?.trusted ?? 0,
                icon: ShieldCheck,
                className: "text-blue-600",
                onClick: () => toggleRole("trusted"),
                active: roleFilter === "trusted",
              },
              {
                label: "Verified",
                value: usersData?.counts?.verified ?? 0,
                icon: BadgeCheck,
                className: "text-emerald-600",
                onClick: () => toggleRole("verified"),
                active: roleFilter === "verified",
              },
            ]}
          />
        }
      >
        <div className="overflow-x-auto border-t">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-muted/30">
              <TableRow>
                {renderHeader("Name", "name")}
                {renderHeader("Email", "email")}
                <TableHead className="whitespace-nowrap">
                  Access / Roles
                </TableHead>
                {renderHeader("Created", "createdAt")}
                {renderHeader("Last login", "lastLogin")}
                <TableHead className="whitespace-nowrap text-right pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Loading user directory...
                  </TableCell>
                </TableRow>
              ) : sortedUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No users match your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                sortedUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="hover:bg-accent/30 transition-colors group"
                  >
                    <TableCell className="font-semibold whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{user.name}</span>
                        {user.nickname && (
                          <span className="text-xs text-muted-foreground font-normal">
                            @{user.nickname}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          variant={user.emailVerified ? "outline" : "secondary"}
                          className={
                            user.emailVerified
                              ? "border-green-200 text-green-700 bg-green-50"
                              : ""
                          }
                        >
                          {user.emailVerified ? "Verified" : "Unverified"}
                        </Badge>
                        {user.isAdmin && (
                          <Badge
                            variant="default"
                            className="bg-primary shadow-sm"
                          >
                            Admin
                          </Badge>
                        )}
                        {user.isTrusted && (
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 border-blue-200 border"
                          >
                            Trusted
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(user.lastLogin).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                        <ActionButtons>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingUser(user);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <DeletePrompt
                            onDelete={() =>
                              deleteUserMutation.mutate(user.id, {
                                onSuccess: () => toast.success(`User deleted`),
                              })
                            }
                            title={`Delete ${user.name}?`}
                            description="This is permanent."
                            variant="ghost"
                            size="icon"
                          />
                        </ActionButtons>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ControlPanel>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          hasNextPage={usersData?.pagination.hasMore || false}
          hasPrevPage={currentPage > 0}
          onPageChange={setCurrentPage}
          totalItems={usersData?.pagination.total || 0}
          pageSize={PAGE_SIZE}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden">
          <div className="p-6 bg-muted/30 border-b">
            <DialogTitle className="text-2xl font-bold">
              Edit Account
            </DialogTitle>
            <DialogDescription>
              Modify permissions and basic details for {editingUser?.name}.
            </DialogDescription>
          </div>
          <div className="p-6 space-y-6">
            <UserForm
              key={editingUser?.id}
              user={editingUser}
              isLoading={updateUserMutation.isPending}
              onSave={(data) => {
                if (editingUser)
                  updateUserMutation.mutate(
                    { userId: editingUser.id, userData: data },
                    {
                      onSuccess: () => {
                        toast.success("Updated");
                        setIsDialogOpen(false);
                        setEditingUser(null);
                      },
                    },
                  );
              }}
            />
            {editingUser && (
              <PasswordSection
                key={`pw-${editingUser.id}`}
                user={editingUser}
                adminApi={adminApi}
              />
            )}
          </div>
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(formData);
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2.5">
          <Label
            htmlFor="name"
            className="text-muted-foreground text-xs uppercase tracking-wider font-semibold"
          >
            Full Name
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            disabled={isLoading}
            className="bg-muted/20"
          />
        </div>
        <div className="space-y-2.5">
          <Label
            htmlFor="email"
            className="text-muted-foreground text-xs uppercase tracking-wider font-semibold"
          >
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
            disabled={isLoading}
            className="bg-muted/20"
          />
        </div>
        <div className="space-y-2.5 sm:col-span-2">
          <Label
            htmlFor="nickname"
            className="text-muted-foreground text-xs uppercase tracking-wider font-semibold"
          >
            Nickname (Optional)
          </Label>
          <Input
            id="nickname"
            value={formData.nickname}
            onChange={(e) =>
              setFormData({ ...formData, nickname: e.target.value })
            }
            disabled={isLoading}
            className="bg-muted/20"
          />
        </div>
      </div>

      <div className="pt-4 border-t">
        <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-4 block">
          Permissions & Settings
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/10 p-4 rounded-xl border">
          <Label className="flex items-center justify-between space-x-2 cursor-pointer p-2 hover:bg-muted/30 rounded-lg transition-colors">
            <span className="font-medium">Email Verified</span>
            <Switch
              checked={formData.emailVerified}
              onCheckedChange={(c) =>
                setFormData({ ...formData, emailVerified: c })
              }
              disabled={isLoading}
            />
          </Label>
          <Label className="flex items-center justify-between space-x-2 cursor-pointer p-2 hover:bg-muted/30 rounded-lg transition-colors">
            <span className="font-medium text-blue-600">Trusted User</span>
            <Switch
              checked={formData.isTrusted}
              onCheckedChange={(c) =>
                setFormData({ ...formData, isTrusted: c })
              }
              disabled={isLoading}
            />
          </Label>
          <Label className="flex items-center justify-between space-x-2 cursor-pointer p-2 hover:bg-muted/30 rounded-lg transition-colors">
            <span className="font-medium text-primary">System Admin</span>
            <Switch
              checked={formData.isAdmin}
              onCheckedChange={(c) => setFormData({ ...formData, isAdmin: c })}
              disabled={isLoading}
            />
          </Label>
          <Label className="flex items-center justify-between space-x-2 cursor-pointer p-2 hover:bg-muted/30 rounded-lg transition-colors">
            <span className="font-medium">Public Favorites</span>
            <Switch
              checked={formData.isFavoritesPublic}
              onCheckedChange={(c) =>
                setFormData({ ...formData, isFavoritesPublic: c })
              }
              disabled={isLoading}
            />
          </Label>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          type="submit"
          disabled={isLoading}
          size="lg"
          className="w-full sm:w-auto shadow-sm"
        >
          {isLoading ? "Saving Changes..." : "Save Account Settings"}
        </Button>
      </div>
    </form>
  );
}

// Minimum enforced server-side by setUserPasswordSchema (better-auth default).
const MIN_PASSWORD_LENGTH = 8;

function PasswordSection({
  user,
  adminApi,
}: {
  user: UserDB;
  adminApi: AdminApi;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const setPasswordMutation = useSetUserPassword(adminApi);
  const isLoading = setPasswordMutation.isPending;

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    password.length >= MIN_PASSWORD_LENGTH && password === confirm && !isLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setPasswordMutation.mutate(
      { userId: user.id, newPassword: password },
      {
        onSuccess: () => {
          toast.success(`Password updated for ${user.name}`);
          setPassword("");
          setConfirm("");
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to set password",
          ),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="pt-6 border-t space-y-4">
      <div>
        <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5" /> Reset Password
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          Set a new password for this account. The user can sign in with it
          immediately.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2.5">
          <Label htmlFor="new-password" className="text-sm font-medium">
            New Password
          </Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="bg-muted/20"
            placeholder="At least 8 characters"
          />
          {tooShort && (
            <p className="text-xs text-destructive">
              Must be at least {MIN_PASSWORD_LENGTH} characters.
            </p>
          )}
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="confirm-password" className="text-sm font-medium">
            Confirm Password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={isLoading}
            className="bg-muted/20"
          />
          {mismatch && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          {isLoading ? "Setting Password..." : "Set Password"}
        </Button>
      </div>
    </form>
  );
}
