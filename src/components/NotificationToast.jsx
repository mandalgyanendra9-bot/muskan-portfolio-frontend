import React, { useEffect } from 'react';
import './NotificationToast.css';
import { useNotification } from '../context/NotificationContext';

const NotificationToast = () => {
  const { notifications, removeNotification } = useNotification();

  // Auto‑dismiss each toast after 5 seconds (context already does this, but keep for safety)
  useEffect(() => {
    if (!notifications.length) return;
    const timer = setTimeout(() => {
      // Remove the oldest notification (or all) – here we clear all for simplicity
      notifications.forEach((n) => removeNotification(n.id));
    }, 5000);
    return () => clearTimeout(timer);
  }, [notifications, removeNotification]);

  if (!notifications.length) return null;
  return (
    <div className="notification-toast-wrapper">
      {notifications.map((n) => (
        <div key={n.id} className="notification-toast">
          <strong>{n.title}</strong>
          <p>{n.message}</p>
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;
