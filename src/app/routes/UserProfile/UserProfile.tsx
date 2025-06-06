import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/custom-ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { User, Camera, Save, LogOut, Shield, Heart } from 'lucide-react';
import { navigate } from 'wouter/use-browser-location';

interface UserProfile {
  id: string;
  nickname: string;
  email: string;
  avatar: string | null;
  is_favorites_public: boolean;
}

const UserProfile: React.FC = () => {
  const { user, logout, token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isFavoritesPublic, setIsFavoritesPublic] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!token) return;

      try {
        const response = await fetch('/api/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          console.log(data)
          setProfile(data.user);
          setNickname(data.user.nickname || data.user.name || '');
          setIsFavoritesPublic(data.user.is_favorites_public || false);
        } else {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to load profile');
        }
      } catch (err) {
        setError('Failed to load profile');
        console.error('Profile load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token]);

  // Handle avatar file selection
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be smaller than 5MB');
        return;
      }

      setAvatarFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!token) {
      toast.error('Please log in to update your profile');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Update basic profile info
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          nickname: nickname,
          is_favorites_public: isFavoritesPublic,
        }),
      });

      if (response.ok) {
        // Handle avatar upload if there's a new file
        if (avatarFile) {
          const formData = new FormData();
          formData.append('avatar', avatarFile);

          const avatarResponse = await fetch('/api/profile/avatar', {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
            body: formData,
          });

          if (!avatarResponse.ok) {
            const avatarError = await avatarResponse.json();
            throw new Error(avatarError.error || 'Failed to upload avatar');
          }
        }

        toast.success('Profile updated successfully!');
        
        // Reset avatar upload state
        setAvatarFile(null);
        setAvatarPreview(null);
        
        // Reload profile to get updated data
        window.location.reload();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Profile update error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate("/");
    } catch (err) {
      toast.error('Error during logout');
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Not Logged In</h2>
              <p className="text-muted-foreground">Please log in to view your profile.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Profile Picture */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Profile Picture
            </CardTitle>
            <CardDescription>
              Upload a new profile picture. Supported formats: JPG, PNG, GIF (max 5MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage 
                  src={avatarPreview || profile.avatar || undefined} 
                  alt={profile.nickname || user.nickname}
                />
                <AvatarFallback className="text-lg">
                  {getInitials(profile.nickname || user.nickname)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Camera className="h-4 w-4" />
                    Change Picture
                  </div>
                </Label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                {avatarFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {avatarFile.name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Update your display name and email preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Display Name</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Email cannot be changed from this page
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy Settings
            </CardTitle>
            <CardDescription>
              Control who can see your activity and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  <Label htmlFor="public-favorites">Public Favorites</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Allow others to see your favorite songs
                </p>
              </div>
              <Switch
                id="public-favorites"
                checked={isFavoritesPublic}
                onCheckedChange={setIsFavoritesPublic}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={handleSaveProfile} 
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          
          <Separator orientation="vertical" className="hidden sm:block h-auto" />
          
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="flex-1 sm:flex-initial"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;