import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 프로젝트 사이트는 /<저장소명>/ 아래에서 서비스된다 → BASE_PATH 로 지정 (로컬은 /)
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { port: 5173 },
});
