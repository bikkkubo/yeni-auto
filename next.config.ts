/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['sharp'],
  env: {
    // Provide dummy values for build time
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy-url-for-build.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-key-for-build',
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || 'dummy-token-for-build',
    SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID || 'dummy-channel-for-build',
    SLACK_ERROR_CHANNEL_ID: process.env.SLACK_ERROR_CHANNEL_ID || 'dummy-error-channel-for-build',
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    CHANNELIO_WEBHOOK_SECRET: process.env.CHANNELIO_WEBHOOK_SECRET || 'dummy-secret-for-build',
  },
};

export default nextConfig;
