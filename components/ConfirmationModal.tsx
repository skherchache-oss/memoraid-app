import React, { useEffect, useCallback } from 'react';
import { Trash2Icon } from '../constants';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'info';
    icon?: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmer',
    cancelText = 'Annuler',
    variant = 'danger',
    icon,
}) => {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.removeEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) {
        return null;
    }

    const isDanger = variant === 'danger';
    const iconContainerClasses = isDanger 
        ? 'bg-red-100 dark:bg-red-900/50' 
        : 'bg-blue-100 dark:bg-blue-900/50';
    const iconClasses = isDanger 
        ? 'text-red-600 dark:text-red-400' 
        : 'text-blue-600 dark:text-blue-400';
    const confirmButtonClasses = isDanger 
        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
        : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';

    const defaultIcon = isDanger ? <Trash2Icon /> : null;
    const finalIcon = icon || defaultIcon;

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-dialog-title"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md m-4"
                role="document"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-start">
                        <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${iconContainerClasses} sm:mx-0 sm:h-10 sm:w-10`}>
                            {finalIcon && React.cloneElement(finalIcon as React.ReactElement, { className: `h-6 w-6 ${iconClasses}`, 'aria-hidden': 'true' })}
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-white" id="confirmation-dialog-title">
                                {title}
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-slate-500 dark:text-zinc-400">
                                    {message}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-900/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-2xl">
                    <button
                        type="button"
                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm transition-colors ${confirmButtonClasses}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-zinc-700 shadow-sm px-4 py-2 bg-white dark:bg-zinc-800 text-base font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm transition-colors"
                        onClick={onClose}
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;