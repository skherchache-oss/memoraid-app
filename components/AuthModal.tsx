
import React, { useState } from 'react';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { XIcon } from '../constants';
import { ToastType } from '../hooks/useToast';
import { useLanguage } from '../contexts/LanguageContext';

interface AuthModalProps {
    onClose: () => void;
    addToast: (message: string, type: ToastType) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, addToast }) => {
    const { t } = useLanguage();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleSignIn = async () => {
        if (!auth || !googleProvider) {
            setError("Le service d'authentification n'est pas configuré (Clés manquantes dans services/firebase.ts).");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await signInWithPopup(auth, googleProvider);
            addToast(t('connection_restored'), "success");
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erreur lors de la connexion Google.");
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth) {
             setError("Le service d'authentification n'est pas configuré.");
             return;
        }
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                addToast(t('connection_restored'), "success");
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                addToast(t('capsule_created'), "success"); // "Account created" logic reusing generic success
            }
            onClose();
        } catch (err: any) {
            console.error(err);
            let msg = "Une erreur est survenue.";
            if (err.code === 'auth/wrong-password') msg = "Mot de passe incorrect.";
            if (err.code === 'auth/user-not-found') msg = "Aucun utilisateur trouvé avec cet e-mail.";
            if (err.code === 'auth/email-already-in-use') msg = "Cet e-mail est déjà utilisé.";
            if (err.code === 'auth/weak-password') msg = "Le mot de passe est trop faible (6 caractères min).";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center md:p-4 animate-fade-in" onClick={onClose}>
            {/* Container: Full screen on mobile (h-full, rounded-none), Card on desktop */}
            <div 
                className="bg-white dark:bg-zinc-900 w-full h-full md:h-auto md:rounded-2xl md:shadow-2xl md:max-w-md flex flex-col overflow-hidden" 
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                        {isLogin ? t('login') : t('create_account')}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                        <XIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </header>

                <div className="p-6 space-y-6 flex-grow overflow-y-auto">
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-300 dark:border-zinc-600 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors font-medium shadow-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        {t('continue_google')}
                    </button>

                    <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-slate-200 dark:border-zinc-700"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">{t('or')}</span>
                        <div className="flex-grow border-t border-slate-200 dark:border-zinc-700"></div>
                    </div>

                    <form onSubmit={handleEmailAuth} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm font-medium border border-red-200 dark:border-red-800/30">
                                {error}
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">{t('email')}</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                                placeholder="nom@exemple.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">{t('password')}</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-md disabled:opacity-70"
                        >
                            {loading ? 'Connexion...' : (isLogin ? t('login') : t('create_account'))}
                        </button>
                    </form>

                    <div className="text-center text-sm pb-4">
                        <p className="text-slate-600 dark:text-zinc-400">
                            {isLogin ? t('no_account') : t('has_account')}
                            <button
                                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                                className="ml-1 text-blue-600 dark:text-blue-400 font-bold hover:underline focus:outline-none"
                            >
                                {isLogin ? t('create_account') : t('login')}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
