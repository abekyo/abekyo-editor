import type { NextConfig } from "next";
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
  turbopack: {},
};

export default withNextIntl(nextConfig);
