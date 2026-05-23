/** @type {import('next').NextConfig} */
import { createRequire } from "module";

// Check if element-tagger is available
function isElementTaggerAvailable() {
  if (process.env.SOFTGEN_ELEMENT_TAGGER !== "true") {
    return false;
  }

  try {
    const require = createRequire(import.meta.url);
    require.resolve("@softgenai/element-tagger");
    return true;
  } catch {
    return false;
  }
}

// Build turbo rules only if tagger is available
function getTurboRules() {
  if (!isElementTaggerAvailable()) {
    console.log("[Softgen] Element tagger not found, skipping loader configuration");
    return {};
  }

  return {
    "*.tsx": {
      loaders: ["@softgenai/element-tagger"],
      as: "*.tsx",
    },
    "*.jsx": {
      loaders: ["@softgenai/element-tagger"],
      as: "*.jsx",
    },
  };
}

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    rules: getTurboRules(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  allowedDevOrigins: ["*.daytona.work", "*.softgen.dev"],
};

export default nextConfig;
