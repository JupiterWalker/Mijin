import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

function aiProxyPlugin(): Plugin {
  return {
    name: 'ai-proxy',
    configureServer(server) {
      server.middlewares.use('/ai-proxy', (req: IncomingMessage, res: ServerResponse) => {
        const targetUrl = req.headers['x-proxy-target'] as string | undefined;
        if (!targetUrl) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing x-proxy-target header' }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
          const body = Buffer.concat(chunks);
          const forwardHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(req.headers)) {
            if (['x-proxy-target', 'host', 'connection'].includes(key)) continue;
            if (typeof value === 'string') forwardHeaders[key] = value;
          }
          try {
            const upstream = await fetch(targetUrl, {
              method: req.method ?? 'POST',
              headers: forwardHeaders,
              body: body.length > 0 ? body : undefined,
            });
            res.statusCode = upstream.status;
            upstream.headers.forEach((value, key) => {
              if (key === 'content-encoding' || key === 'transfer-encoding') return;
              res.setHeader(key, value);
            });
            res.setHeader('access-control-allow-origin', '*');
            res.end(Buffer.from(await upstream.arrayBuffer()));
          } catch (err: unknown) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [react(), aiProxyPlugin()],
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
