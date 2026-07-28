import type { NextConfig } from "next";

import { FACTS_PICTURE_BASE_URL } from "./src/lib/facts/pictures";

// Read off the one place the tenant location is written down, so this file and
// the derivation can't drift into disagreeing about the host.
const pictures = new URL(FACTS_PICTURE_BASE_URL);

const nextConfig: NextConfig = {
  images: {
    // The ceiling on what the image layer may ever fetch: the school's FACTS
    // tenant pictures folder, host *and* path. Staff photos don't currently go
    // through the optimizer at all — they're plain <img> straight from FACTS,
    // because the portal is to store no image bytes (#52) — so this is the
    // allowlist standing ready, not a description of today's traffic.
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
