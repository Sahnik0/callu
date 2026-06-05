"use client";
import React from "react";

export default function SmoothScrolling({ children }: { children: React.ReactNode }) {
  // Disabled Lenis for Electron - using native CSS overflow scrolling instead
  return <>{children}</>;
}
