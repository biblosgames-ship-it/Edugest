import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '../context/AppContext';
import { dataService } from '../services/dataService';

export const getDismissedCommIds = (userId?: string): Set<string> => {
  const dismissed = new Set<string>();
  try {
    // 1. Global dismissed key
    const globalData = localStorage.getItem('edugens_dismissed_comms_all');
    if (globalData) {
      try {
        JSON.parse(globalData).forEach((id: string) => id && dismissed.add(String(id)));
      } catch (e) {}
    }

    // 2. User specific key
    if (userId) {
      const userData = localStorage.getItem(`edugens_dismissed_comms_${userId}`);
      if (userData) {
        try {
          JSON.parse(userData).forEach((id: string) => id && dismissed.add(String(id)));
        } catch (e) {}
      }
    }

    // 3. Scan all edugens_dismissed_comms_ keys
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('edugens_dismissed_comms_')) {
        const val = localStorage.getItem(k);
        if (val) {
          try {
            JSON.parse(val).forEach((id: string) => id && dismissed.add(String(id)));
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  return dismissed;
};

export const saveDismissedCommIds = (commIds: string[], userId?: string) => {
  try {
    const current = getDismissedCommIds(userId);
    commIds.forEach((id) => {
      if (id) current.add(String(id));
    });
    const arr = Array.from(current);
    localStorage.setItem('edugens_dismissed_comms_all', JSON.stringify(arr));
    if (userId) {
      localStorage.setItem(`edugens_dismissed_comms_${userId}`, JSON.stringify(arr));
    }
    window.dispatchEvent(new CustomEvent('edugens_notifications_updated'));
  } catch (e) {}
};

export const useNotifications = () => {
  const { user, profile } = useSupabase();
  const [communications, setCommunications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const userId = user?.id || profile?.id;
  const role = profile?.role || 'teacher';

  const fetchComms = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await dataService.getCommunications(userId, role);
      const dismissed = getDismissedCommIds(userId);
      const active = (data || []).filter((c: any) => c?.id && !dismissed.has(String(c.id)));
      setCommunications(active);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, role]);

  useEffect(() => {
    fetchComms();

    const handleUpdate = () => {
      const dismissed = getDismissedCommIds(userId);
      setCommunications((prev) => prev.filter((c) => c?.id && !dismissed.has(String(c.id))));
    };

    window.addEventListener('edugens_notifications_updated', handleUpdate);
    return () => {
      window.removeEventListener('edugens_notifications_updated', handleUpdate);
    };
  }, [fetchComms, userId]);

  const dismiss = useCallback(
    async (id: string) => {
      saveDismissedCommIds([id], userId);
      setCommunications((prev) => prev.filter((c) => String(c.id) !== String(id)));
      try {
        await dataService.dismissCommunication(id, userId || '');
      } catch (e) {}
    },
    [userId]
  );

  const dismissAll = useCallback(async () => {
    const ids = communications.map((c) => String(c.id));
    saveDismissedCommIds(ids, userId);
    setCommunications([]);
    try {
      await Promise.all(ids.map((id) => dataService.dismissCommunication(id, userId || '')));
    } catch (e) {}
  }, [communications, userId]);

  return {
    communications,
    unreadCount: communications.length,
    loading,
    dismiss,
    dismissAll,
    refetch: fetchComms
  };
};
