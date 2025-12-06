import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Bell, X, Check } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

interface NotificationBellProps {
  onNavigate?: (tab: string) => void;
}

export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const notifications = useQuery(api.dashboard.getUserNotifications, {
    limit: 20,
    unreadOnly: false,
  });
  const markAsRead = useMutation(api.dashboard.markNotificationAsRead);
  const markAllAsRead = useMutation(api.dashboard.markAllNotificationsAsRead);

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  // Show toast when new notifications arrive (only once per notification)
  const [shownNotificationIds, setShownNotificationIds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (notifications) {
      // Filter for notifications that should show as toasts
      const notificationsToShow = notifications.filter(
        (n) => 
          (n.type === "medication_reminder" || 
           n.type === "test_result_ready" || 
           n.type === "assessment_reminder") && 
          !n.isRead && 
          !shownNotificationIds.has(n._id)
      );
      
      notificationsToShow.forEach((notification) => {
        // Determine toast type based on notification type
        let toastType: "info" | "success" | "warning" = "info";
        if (notification.type === "test_result_ready") {
          toastType = "success";
        } else if (notification.type === "assessment_reminder") {
          toastType = "warning";
        }

        const toastOptions: any = {
          description: notification.message,
          duration: 5000,
          action: {
            label: "View",
            onClick: () => {
              setIsOpen(true);
              if (notification.actionUrl) {
                // Parse the actionUrl to extract tab parameter
                const url = new URL(notification.actionUrl, window.location.origin);
                const tab = url.searchParams.get("tab");
                if (tab && onNavigate) {
                  onNavigate(tab);
                } else if (notification.actionUrl.startsWith("/")) {
                  // Fallback to window.location if no callback provided
                  window.location.href = notification.actionUrl;
                }
              }
            },
          },
        };

        // Show appropriate toast type
        if (toastType === "success") {
          toast.success(notification.title, toastOptions);
        } else if (toastType === "warning") {
          toast.warning(notification.title, toastOptions);
        } else {
          toast.info(notification.title, toastOptions);
        }

        // Track that we've shown this notification
        setShownNotificationIds((prev) => new Set(prev).add(notification._id));
      });
    }
  }, [notifications, shownNotificationIds, onNavigate]);

  const handleMarkAsRead = async (notificationId: Id<"notifications">) => {
    try {
      await markAsRead({ notificationId });
    } catch (error: any) {
      toast.error(error.message || "Failed to mark notification as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead({});
      toast.success("All notifications marked as read");
    } catch (error: any) {
      toast.error(error.message || "Failed to mark all as read");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "medication_reminder":
        return "💊";
      case "assessment_reminder":
        return "📅";
      case "high_risk_alert":
        return "⚠️";
      case "doctor_assignment_request":
      case "patient_assignment_request":
        return "👨‍⚕️";
      default:
        return "🔔";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "medication_reminder":
        return "bg-blue-50 border-blue-200";
      case "assessment_reminder":
        return "bg-green-50 border-green-200";
      case "high_risk_alert":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications === undefined ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notification.isRead ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p
                                className={`text-sm font-medium ${
                                  !notification.isRead
                                    ? "text-gray-900"
                                    : "text-gray-700"
                                }`}
                              >
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatTime(notification._creationTime)}
                              </p>
                            </div>
                            {!notification.isRead && (
                              <button
                                onClick={() => handleMarkAsRead(notification._id)}
                                className="p-1 hover:bg-blue-100 rounded-lg flex-shrink-0"
                                title="Mark as read"
                              >
                                <Check className="w-4 h-4 text-blue-600" />
                              </button>
                            )}
                          </div>
                          {notification.actionUrl && (
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                // Parse the actionUrl to extract tab parameter
                                const url = new URL(notification.actionUrl, window.location.origin);
                                const tab = url.searchParams.get("tab");
                                if (tab && onNavigate) {
                                  onNavigate(tab);
                                } else if (notification.actionUrl.startsWith("/")) {
                                  // Fallback to window.location if no callback provided
                                  window.location.href = notification.actionUrl;
                                }
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block"
                            >
                              View →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

