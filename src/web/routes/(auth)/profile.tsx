import { createFileRoute, redirect } from "@tanstack/react-router";
import { Camera, LogOut, Save, Shield, User } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { ProfileUpdateData, UserProfileData } from "src/worker/api/userProfile";
import { AvatarWithFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { useAuthActions } from "~/hooks/use-auth-actions";
import { useIsOnline } from "~/hooks/use-is-online";
import { redirectSearchSchema } from "~/main";
import { ApiException, handleApiResponse } from "~/services/api-service";

type ProfileUpdateResponse = {
  status: string;
  data: ProfileUpdateData;
  imageUrl?: string;
};

export const Route = createFileRoute("/(auth)/profile")({
  component: RouteComponent,
  validateSearch: (search) => redirectSearchSchema.parse(search),
  loader: async ({ context }) => {
    const userProfileData = context.queryClient.getQueryData([
      "userProfile",
    ]) as UserProfileData;
    if (!userProfileData?.loggedIn) {
      throw redirect({
        to: "/login",
        search: { redirect: context.redirectURL },
      });
    }
    return {
      userProfileData,
    };
  },
});

function RouteComponent() {
  const { userProfileData } = Route.useLoaderData();
  const profile = userProfileData.profile;
  const { redirectURL } = Route.useRouteContext();
  const { redirect: searchRedirect } = Route.useSearch();
  const { logout, refreshAuth } = useAuthActions();

  const navigate = Route.useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create initial state object matching userProfile structure
  const initialState = {
    name: profile.name,
    nickname: profile?.nickname || "",
    email: profile.email,
    image: profile?.image || null,
    isFavoritesPublic: profile.isFavoritesPublic,
  };

  // Current state (what user is editing)
  const [currentData, setCurrentData] = useState(initialState);
  // Saved state (baseline for comparison)
  const [savedData, setSavedData] = useState(initialState);

  // UI-specific states
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarToDelete, setAvatarToDelete] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ nickname?: string }>({});

  const validateForm = () => {
    const errors: { nickname?: string } = {};

    if (currentData.nickname && currentData.nickname.includes("/")) {
      errors.nickname = "Nickname cannot contain the '/' character";
    }
    if (currentData.nickname && currentData.nickname.length > 30) {
      errors.nickname = "Nickname is too long (max 30 characters)";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) {
      toast.error("Please fix the errors before saving.");
      return;
    }

    setSaving(true);
    setFieldErrors({});

    try {
      const formData = new FormData();
      formData.append("name", currentData.name);
      formData.append("nickname", currentData.nickname || "");
      formData.append(
        "isFavoritesPublic",
        String(currentData.isFavoritesPublic),
      );
      if (pendingAvatarFile) formData.append("avatarFile", pendingAvatarFile);
      if (avatarToDelete && !pendingAvatarFile)
        formData.append("deleteAvatar", "true");

      const response = await fetch("/api/profile", {
        method: "PUT",
        body: formData,
      });

      const data = await handleApiResponse<ProfileUpdateResponse>(response);

      const updatedData = { ...currentData };
      if (data.imageUrl !== undefined) {
        updatedData.image = data.imageUrl;
      }

      setCurrentData(updatedData);
      setPendingAvatarFile(null);
      setAvatarPreview(null);
      setAvatarToDelete(false);
      setSavedData(updatedData);

      // Centralized global cache and router flush
      await refreshAuth();
      toast.success("Profile updated successfully");

      // Redirect if redirect parameter is present and is a valid string
      if (searchRedirect && typeof searchRedirect === "string") {
        navigate({ to: searchRedirect });
      }
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.code === "NICKNAME_TAKEN") {
          setFieldErrors((prev) => ({ ...prev, nickname: err.message }));
          toast.error("Nickname is already taken");
        } else {
          toast.error(err.message || "Failed to update profile");
        }
      } else if (err instanceof Error) {
        toast.error(err.message || "Failed to update profile");
      } else {
        toast.error("An unexpected error occurred while updating profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setPendingAvatarFile(file);
    setAvatarToDelete(false);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setPendingAvatarFile(null);
    setAvatarToDelete(true);
    toast.success("Avatar will be removed when you save changes.");
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleCancelAvatarChange = () => {
    setAvatarPreview(null);
    setPendingAvatarFile(null);
    setAvatarToDelete(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const hasChanges = () => {
    const dataChanged =
      currentData.name !== savedData.name ||
      currentData.nickname !== savedData.nickname ||
      currentData.isFavoritesPublic !== savedData.isFavoritesPublic;

    const avatarChanged = pendingAvatarFile !== null || avatarToDelete;

    return dataChanged || avatarChanged;
  };

  const updateField = <K extends keyof typeof currentData>(
    field: K,
    value: (typeof currentData)[K],
  ) => {
    setCurrentData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container max-w-4xl mx-auto">
      <div className="space-y-8">
        <ProfileHeader />

        <div className="grid gap-6">
          <ProfilePictureSection
            userProfile={profile}
            currentAvatar={currentData.image}
            avatarPreview={avatarPreview}
            avatarToDelete={avatarToDelete}
            pendingAvatarFile={pendingAvatarFile}
            onAvatarChange={handleAvatarChange}
            onRemoveAvatar={handleRemoveAvatar}
            onAvatarClick={handleAvatarClick}
            onCancelAvatarChange={handleCancelAvatarChange}
            fileInputRef={fileInputRef}
          />

          <BasicInformationSection
            name={currentData.name}
            nickname={currentData.nickname}
            email={currentData.email}
            error={fieldErrors.nickname}
            onNicknameChange={(value) => {
              updateField("nickname", value);
              if (value.includes("/")) {
                setFieldErrors((prev) => ({
                  ...prev,
                  nickname: "Nickname cannot contain the '/' character",
                }));
              } else {
                if (fieldErrors.nickname) {
                  setFieldErrors((prev) => ({ ...prev, nickname: undefined }));
                }
              }
            }}
            onNameChange={(value) => updateField("name", value)}
          />

          <PrivacySection
            isFavoritesPublic={currentData.isFavoritesPublic}
            onToggleFavoritesPublic={(value) =>
              updateField("isFavoritesPublic", value)
            }
          />
        </div>

        <Separator />

        <ActionButtons
          saving={saving}
          hasChanges={hasChanges()}
          onSave={handleSaveProfile}
          onLogout={() =>
            logout(typeof redirectURL === "string" ? redirectURL : "/")
          }
        />
      </div>
    </div>
  );
}

function ProfileHeader() {
  return (
    <div className="text-center space-y-2">
      <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
      <p className="text-muted-foreground">
        Manage your account settings and preferences
      </p>
    </div>
  );
}

interface ProfilePictureSectionProps {
  userProfile: UserProfileData["profile"];
  currentAvatar: string | null;
  avatarPreview: string | null;
  avatarToDelete: boolean;
  pendingAvatarFile: File | null;
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAvatar: () => void;
  onAvatarClick: () => void;
  onCancelAvatarChange: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

function ProfilePictureSection({
  userProfile,
  currentAvatar,
  avatarPreview,
  avatarToDelete,
  pendingAvatarFile,
  onAvatarChange,
  onRemoveAvatar,
  onAvatarClick,
  onCancelAvatarChange,
  fileInputRef,
}: ProfilePictureSectionProps) {
  const displayAvatar = avatarToDelete ? null : avatarPreview || currentAvatar;

  if (!userProfile) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Avatar
        </CardTitle>
        <CardDescription>
          Upload a new avatar for your songbook and feed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <div
            className="relative group cursor-pointer"
            onClick={onAvatarClick}
            title="Click to change avatar"
          >
            <AvatarWithFallback
              avatarSrc={displayAvatar || undefined}
              fallbackStr={userProfile.name || ""}
              avatarClassName="h-24 w-24 border-4 border-background shadow-lg transition-all group-hover:border-primary/50"
              fallbackClassName="text-xl font-semibold"
            />
            <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </div>

          {(pendingAvatarFile || avatarToDelete) && (
            <div className="text-center space-y-1">
              <p
                className={`text-sm font-medium ${avatarToDelete ? "text-red-600" : "text-blue-600"}`}
              >
                {avatarToDelete
                  ? "Avatar will be removed"
                  : `Selected: ${pendingAvatarFile?.name}`}
              </p>
              <p className="text-xs text-muted-foreground">
                Click "Save Changes" to confirm
              </p>
            </div>
          )}

          <div className="flex flex-col items-center space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onAvatarChange}
              className="hidden"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onAvatarClick}>
                <Camera className="h-4 w-4 mr-2" />
                Choose Picture
              </Button>
              {(currentAvatar || avatarPreview) && !avatarToDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={onRemoveAvatar}
                >
                  Remove
                </Button>
              )}
              {(pendingAvatarFile || avatarToDelete) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancelAvatarChange}
                >
                  Cancel
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              JPG, PNG, or GIF up to 5MB.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface BasicInformationSectionProps {
  name: string;
  nickname: string;
  email: string;
  error?: string;
  onNicknameChange: (value: string) => void;
  onNameChange: (value: string) => void;
}

function BasicInformationSection({
  name,
  nickname,
  email,
  error,
  onNicknameChange,
  onNameChange,
}: BasicInformationSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Basic Information
        </CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nickname" className={error ? "text-destructive" : ""}>
            Nickname
          </Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            className={
              error ? "border-destructive focus-visible:ring-destructive" : ""
            }
          />
          {error ? (
            <p className="text-sm text-destructive font-medium">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Used instead of your name on your songbook.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input id="email" value={email} disabled className="bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

interface PrivacySectionProps {
  isFavoritesPublic: boolean;
  onToggleFavoritesPublic: (value: boolean) => void;
}

function PrivacySection({
  isFavoritesPublic,
  onToggleFavoritesPublic,
}: PrivacySectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Privacy Settings
        </CardTitle>
        <CardDescription>Control visibility preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="public-favorites" className="font-medium">
              Public Favorites
            </Label>
            <p className="text-sm text-muted-foreground">
              Others can filter by your favorites
            </p>
          </div>
          <Switch
            id="public-favorites"
            checked={isFavoritesPublic}
            onCheckedChange={onToggleFavoritesPublic}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface ActionButtonsProps {
  saving: boolean;
  hasChanges: boolean;
  onSave: () => void;
  onLogout: () => void;
}

function ActionButtons({
  saving,
  hasChanges,
  onSave,
  onLogout,
}: ActionButtonsProps) {
  const isOnline = useIsOnline();
  return (
    <div className="flex flex-row flex-wrap-reverse gap-3 justify-between">
      <Button
        variant="destructive"
        onClick={onLogout}
        className="sm:w-auto"
        disabled={!isOnline}
      >
        <LogOut className="mr-2 h-4 w-4" /> Logout
      </Button>
      <Button
        onClick={onSave}
        disabled={saving || !hasChanges || !isOnline}
        className="sm:w-auto"
      >
        {saving ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </>
        )}
      </Button>
    </div>
  );
}
