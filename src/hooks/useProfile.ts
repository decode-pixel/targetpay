import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Try to get existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // If no profile exists, create one
      if (!data) {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          })
          .select()
          .single();

        if (createError) throw createError;
        return newProfile as Profile;
      }

      // Resolve avatar_url: if it's a storage path (not a full URL), generate a short-lived signed URL
      if (data.avatar_url && !data.avatar_url.startsWith('http')) {
        const { data: signedUrlData } = await supabase.storage
          .from('avatars')
          .createSignedUrl(data.avatar_url, 60 * 60); // 1 hour expiry
        if (signedUrlData?.signedUrl) {
          data.avatar_url = signedUrlData.signedUrl;
        }
      }

      return data as Profile;
    },
    enabled: !!user,
    staleTime: 15 * 60 * 1000, // 15 minutes - refresh signed URL before 1hr expiry
    refetchOnWindowFocus: true,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<Profile, 'full_name' | 'avatar_url'>>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as Profile;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated');
    },
    onError: (error) => {
      toast.error('Failed to update profile: ' + error.message);
    },
  });
}
