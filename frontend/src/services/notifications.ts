import api from './api';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export const notificationsApi = {
  getNotifications: (limit?: number, offset?: number) =>
    api.get<{ notifications: Notification[]; total: number; unread: number }>('/notifications', { params: { limit, offset } }).then(r => r.data),
  getUnreadCount: () => api.get<{ count: number }>('/notifications/unread-count').then(r => r.data),
  markAsRead: (id: string) => api.post(`/notifications/${id}/read`).then(r => r.data),
  markAllAsRead: () => api.post('/notifications/read-all').then(r => r.data),
};
