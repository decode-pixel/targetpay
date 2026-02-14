import { useState, useRef } from 'react';
import { Loader2, Camera, Save, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { Switch } from '@/components/ui/switch';

export default function Profile() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const { isMockMode, toggleMockMode } = useSubscription();
  const showDev = import.meta.env.DEV || searchParams.get('dev') === 'true';
  
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  
  const [fullName, setFullName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state with profile data
  useState(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
  });

  // Update local state when profile loads
  if (profile && !hasChanges && fullName !== (profile.full_name || '')) {
    setFullName(profile.full_name || '');
  }

  const handleNameChange = (value: string) => {
    setFullName(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateProfile.mutateAsync({ full_name: fullName });
    setHasChanges(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the storage path (not a signed URL) in the database
      await updateProfile.mutateAsync({ 
        avatar_url: fileName 
      });

      toast.success('Avatar updated!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || 'U';

  const memberSince = user.created_at 
    ? format(new Date(user.created_at), 'MMMM yyyy')
    : 'Unknown';

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account settings
          </p>
        </div>

        {/* Avatar Section */}
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <Avatar className="h-24 w-24 md:h-28 md:w-28 border-4 border-background shadow-lg">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={handleAvatarClick}
                  disabled={isUploading}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">
                  {profile?.full_name || 'Set your name'}
                </p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Member since {memberSince}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your name"
                value={fullName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email || ''}
                disabled
                className="h-12 bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateProfile.isPending}
              className="w-full h-12"
            >
              {updateProfile.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Developer Settings */}
        {showDev && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                🧪 Developer Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Mock Premium Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Test all premium features without Stripe
                  </p>
                </div>
                <Switch
                  checked={isMockMode}
                  onCheckedChange={toggleMockMode}
                />
              </div>
              {isMockMode && (
                <p className="text-xs text-warning">
                  ⚠️ All premium features are unlocked for testing.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sign Out */}
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Sign Out
        </Button>
      </div>
    </AppLayout>
  );
}
