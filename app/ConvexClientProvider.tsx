"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const DEFAULT_CONVEX_URL = "https://veracious-finch-754.convex.cloud";
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || DEFAULT_CONVEX_URL;
const convex = new ConvexReactClient(convexUrl);

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
