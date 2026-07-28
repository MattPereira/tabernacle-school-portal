import type { NextConfig } from "next";

import { FACTS_PICTURE_BASE_URL } from "./src/lib/facts/pictures";

// Read off the one place the tenant location is written down, so this file and
// the derivation can't drift into disagreeing about the host.
const pictures = new URL(FACTS_PICTURE_BASE_URL);

const nextConfig: NextConfig = {
  images: {
    // The only place the optimizer may fetch from: the school's FACTS tenant
    // pictures folder, host *and* path, so a filename that slipped past
    // derivation still can't make this an open image proxy.
    //
    // Staff photos do go through the optimizer, which means Next fetches each
    // portrait server-side and caches the resized bytes (minimumCacheTTL, 4h by
    // default). That's a deliberate reversal of #52's "portal stores no image
    // bytes": the FACTS pictures URLs are public, so the cache exposes nothing
    // FACTS doesn't already serve, and a photo up to 4h stale is worth not
    // shipping a full portrait per row.
    remotePatterns: [
      {
        protocol: "https",
        hostname: pictures.hostname,
        pathname: `${pictures.pathname}**`,
      },
    ],
  },
};

export default nextConfig;
