import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContacts, getNeedsAttention, updateContact, deleteContact } from '../api/contacts.js';

export const CONTACTS_KEY = 'contacts';

export const useContacts = (filters = {}) => {
  return useQuery({
    queryKey: [CONTACTS_KEY, filters],
    queryFn: () => getContacts(filters),
    placeholderData: (prev) => prev, // keeps previous data while fetching new page
    staleTime: 30_000,
  });
};

export const useNeedsAttention = (params = {}) => {
  return useQuery({
    queryKey: [CONTACTS_KEY, 'needs-attention', params],
    queryFn: () => getNeedsAttention(params),
    staleTime: 30_000,
  });
};

export const useUpdateContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateContact(id, data),
    onSuccess: () => {
      // Invalidate all contact queries (list + pipeline counts)
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
    },
  });
};

export const useDeleteContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
    },
  });
};
