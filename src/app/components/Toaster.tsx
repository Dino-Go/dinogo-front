'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Notification {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
}

interface ToastContextType {
    notifications: Notification[];
    addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
    removeNotification: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = (type: 'success' | 'error' | 'info', message: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        const notification = { id, type, message };

        setNotifications(prev => [...prev, notification]);

        // Auto remove after 5 seconds
        setTimeout(() => {
            removeNotification(id);
        }, 5000);
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(notif => notif.id !== id));
    };

    return (
        <ToastContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}
            <ToastContainer notifications={notifications} onRemove={removeNotification} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

function ToastContainer({
    notifications,
    onRemove
}: {
    notifications: Notification[];
    onRemove: (id: string) => void;
}) {
    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map(notification => (
                <div
                    key={notification.id}
                    className={`
                        px-4 py-3 rounded-md shadow-lg transition-all duration-300 ease-in-out
                        ${notification.type === 'success'
                            ? 'bg-green-50 border border-green-200 text-green-800'
                            : notification.type === 'error'
                            ? 'bg-red-50 border border-red-200 text-red-800'
                            : 'bg-blue-50 border border-blue-200 text-blue-800'
                        }
                    `}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{notification.message}</p>
                        <button
                            onClick={() => onRemove(notification.id)}
                            className="ml-3 text-gray-400 hover:text-gray-600"
                        >
                            ×
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}