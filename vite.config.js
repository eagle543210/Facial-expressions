import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [
        basicSsl()
    ],
    server: {
        host: true,
        port: 3000,
        https: true,
    },
    build: {
        outDir: 'dist',
    }
});
