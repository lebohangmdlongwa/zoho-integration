// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import wix from '@wix/astro';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import { fileURLToPath } from 'node:url';

const env = loadEnv('development', process.cwd(), '');
Object.assign(process.env, env);

const zohoWebhookBypass = {
  name: 'zoho-webhook-bypass',
  hooks: {
    /** @param {{ addMiddleware: Function }} param0 */
    'astro:config:setup': ({ addMiddleware }) => {
      addMiddleware({
        entrypoint: fileURLToPath(new URL('./src/webhook-bypass.ts', import.meta.url)),
        order: 'pre',
      });
    },
  },
};

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [zohoWebhookBypass, wix(), react()],
  image: { domains: ['static.wixstatic.com'] },
  security: { checkOrigin: false },
  devToolbar: { enabled: false },
  server: { allowedHosts: true },
  vite: {
    server: { cors: true },
    resolve: {
      alias: {
        '@wix/headless-node': fileURLToPath(
          new URL('./node_modules/@wix/headless-node/build/index.js', import.meta.url),
        ),
      },
    },
  },
});
