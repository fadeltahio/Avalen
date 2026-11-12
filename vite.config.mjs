import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Quick share links (Cloudflare tunnel) arrive under *.trycloudflare.com; no other outside host is accepted.
const shareHosts = ['.trycloudflare.com'];
export default defineConfig({plugins:[react()],server:{allowedHosts:shareHosts,proxy:{'/api':{target:'http://127.0.0.1:5180',changeOrigin:false}}},preview:{allowedHosts:shareHosts}});
