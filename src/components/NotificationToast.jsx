import React, { useEffect, useState } from 'react';
import './NotificationToast.css';

const NotificationToast = ({ notifications, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // auto dismiss after 5s
    return () => clearTimeout(timer);
  }, [notifications]);

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
