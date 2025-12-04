import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ''); // charger toutes les variables d'environnement

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'), // alias racine projet
      },
    },
    css: {
      postcss: './postcss.config.cjs', // indique le fichier de config PostCSS
    },
    build: {
      target: 'esnext', // compatible avec Vercel et moderne
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
