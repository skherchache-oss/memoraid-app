import React, { useEffect, useState } from 'react';
import type { ToastMessage, ToastType } from '../hooks/useToast';
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from '../constants';

const ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircleIcon className="w-6 h-6 text-emerald-500" />,
    error: <AlertCircleIcon className="w-6 h-6 text-red-500" />,
    info: <InfoIcon className="w-6 h-6 text-blue-500" />,
};

const TOAST_CLASSES: Record<ToastType, string> = {
    success: 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800/50',
    error: 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800/50',
    info: 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800/50',
};

interface ToastProps {
  toast: ToastMessage;
  remove: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, remove }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            const removeTimer = setTimeout(remove, 300); // Corresponds to animation duration
            return () => clearTimeout(removeTimer);
        }, 4700); // Start exit animation just before removal

        return () => clearTimeout(timer);
    }, [remove]);

    const handleRemove = () => {
        setIsExiting(true);
        setTimeout(remove, 300);
    };

    return (
        <div className={`w-full max-w-sm p-4 rounded-xl shadow-lg border flex items-start gap-3 ${TOAST_CLASSES[toast.type]} ${isExiting ? 'animate-toast-exit' : 'animate-toast-enter'}`}>
            <div className="flex-shrink-0">
                {ICONS[toast.type]}
            </div>
            <p className="flex-grow text-sm font-medium text-slate-700 dark:text-zinc-200">{toast.message}</p>
            <button
                onClick={handleRemove}
                className="p-1 -m-1 rounded-full text-slate-400 dark:text-zinc-500 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label="Fermer la notification"
            >
                <XIcon className="w-5 h-5" />
            </button>
        </div>
    );
};


interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: number) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-full max-w-sm space-y-3">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} remove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};