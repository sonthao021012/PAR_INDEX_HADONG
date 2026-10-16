import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

const SYNC_CACHE_FILE = path.resolve(process.cwd(), '.cchc_drive_store.json');

function gasProxyPlugin(): Plugin {
  return {
    name: 'gas-proxy-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Local Server Sync Store endpoint for guaranteed persistence across devices & reloads
        if (req.url && req.url.startsWith('/api/drive-sync-store')) {
          if (req.method === 'GET') {
            try {
              if (fs.existsSync(SYNC_CACHE_FILE)) {
                const content = fs.readFileSync(SYNC_CACHE_FILE, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(content);
                return;
              }
            } catch (e) {
              console.warn('Error reading sync store:', e);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ found: false }));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                fs.writeFileSync(SYNC_CACHE_FILE, body, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, savedAt: new Date().toISOString() }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: String(e) }));
              }
            });
            return;
          }
        }

        // Google Apps Script Proxy endpoint
        if (req.url && req.url.startsWith('/api/gas-proxy')) {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const targetUrl = parsed.targetUrl || 'https://script.google.com/macros/s/AKfycbxDxwdm-7tirCSzOcyftN0Dvf8H2SkiCdsro9d-OM-i3a7146IBVi-vjHjrJ5P5eNU0qQ/exec';
                const payload = parsed.payload || {};
                const response = await fetch(targetUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: JSON.stringify(payload),
                  redirect: 'follow',
                });
                const text = await response.text();
                res.setHeader('Content-Type', 'application/json');
                res.end(text);
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: String(err) }));
              }
            });
            return;
          }
          if (req.method === 'GET') {
            try {
              const urlObj = new URL(req.url, 'http://localhost:3000');
              const targetUrl = urlObj.searchParams.get('targetUrl') || 'https://script.google.com/macros/s/AKfycbxDxwdm-7tirCSzOcyftN0Dvf8H2SkiCdsro9d-OM-i3a7146IBVi-vjHjrJ5P5eNU0qQ/exec';
              const response = await fetch(targetUrl, { redirect: 'follow' });
              const text = await response.text();
              res.setHeader('Content-Type', 'application/json');
              res.end(text);
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(err) }));
            }
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), gasProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

