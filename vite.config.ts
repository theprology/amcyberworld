import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, loadEnv } from 'vite';

const LOCAL_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const localBindingConfig = {
  main: 'vinext/server/app-router-entry',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: [
    {
      binding: 'DB',
      database_name: 'site-creator-d1',
      database_id: LOCAL_DATABASE_ID,
    },
  ],
  r2_buckets: [
    {
      binding: 'FILES',
      bucket_name: 'site-creator-r2',
    },
  ],
};

export default defineConfig(async ({ mode }) => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  const { cloudflare } = await import('@cloudflare/vite-plugin');
  const localEnv = loadEnv(mode, process.cwd(), '');
  const agentAccessCode = localEnv.AGENT_ACCESS_CODE?.trim();

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: {
          ...localBindingConfig,
          vars: agentAccessCode ? { AGENT_ACCESS_CODE: agentAccessCode } : {},
        },
      }),
    ],
  };
});
