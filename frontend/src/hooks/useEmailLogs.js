import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingDrafts, approveDraft, discardDraft, updateDraft } from '../api/emailLogs.js';

export const EMAIL_LOGS_KEY = 'email-logs';

export const usePendingDrafts = (params = {}) => {
  return useQuery({
    queryKey: [EMAIL_LOGS_KEY, 'pending', params],
    queryFn: () => getPendingDrafts(params),
    placeholderData: (prev) => prev,
    staleTime: 20_000,
  });
};

export const useUpdateDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (arg) => {
      const { draftId, data } = typeof arg === 'string' ? { draftId: arg, data: undefined } : (arg || {});
      return updateDraft(draftId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMAIL_LOGS_KEY] });
    },
  });
};

export const useApproveDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (arg) => {
      const { draftId, data } = typeof arg === 'string' ? { draftId: arg, data: undefined } : (arg || {});
      return approveDraft(draftId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMAIL_LOGS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};

export const useDiscardDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (arg) => {
      const draftId = typeof arg === 'string' ? arg : arg?.draftId;
      return discardDraft(draftId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMAIL_LOGS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};
