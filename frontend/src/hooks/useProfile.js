import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProfile,
  updateProfileUrls,
  analyzeProfile,
  uploadResume,
  testGenerateDraft,
} from '../api/profile.js';

export const PROFILE_KEY = 'user-profile';

export const useProfile = () => {
  return useQuery({
    queryKey: [PROFILE_KEY],
    queryFn: getProfile,
    staleTime: 30_000,
  });
};

export const useUploadResume = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file) => uploadResume(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROFILE_KEY] });
    },
  });
};

export const useUpdateProfileUrls = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (urls) => updateProfileUrls(urls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROFILE_KEY] });
    },
  });
};

export const useAnalyzeProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: analyzeProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROFILE_KEY] });
    },
  });
};

export const useTestGenerateDraft = () => {
  return useMutation({
    mutationFn: (data) => testGenerateDraft(data),
  });
};
