import { useEffect } from "react";
import "./NotificationToast.css";
import { useNotification } from "../context/NotificationContext";

const NotificationToast = () => {
  const { notifications, removeNotification } = useNotification();

  useEffect(() => {
    if (!notifications.length) return undefined;

    const timer = window.setTimeout(() => {
      notifications.forEach((notification) => removeNotification(notification.id));
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [notifications, removeNotification]);

  if (!notifications.length) return null;

  return (
    <div className="notification-toast-wrapper">
      {notifications.map((notification) => (
        <div key={notification.id} className="notification-toast">
          <strong>{notification.title}</strong>
          <p>{notification.message}</p>
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;
