import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@remotion/bundler',
    '@remotion/renderer',
  ],
  transpilePackages: ['@remotion/player'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    } else {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          '@remotion/bundler': 'commonjs @remotion/bundler',
          '@remotion/renderer': 'commonjs @remotion/renderer',
        });
      }
    }
    return config;
  },
  turbopack: {
    // Anchor Turbopack to this project directory. Without this, Turbopack
    // can climb to a higher directory if it finds another lockfile there
    // (e.g. ~/package-lock.json), which then triggers permission errors when
    // it tries to traverse the user's home directory.
    root: path.resolve(__dirname),
  },
};

export default withNextIntl(nextConfig);
