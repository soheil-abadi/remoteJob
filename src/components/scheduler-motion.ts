"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

export { gsap };

export function useSchedulerMotion(animate: () => void, dependencies: unknown[]) {
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", animate);
    return () => media.revert();
  }, { dependencies, revertOnUpdate: true });
}
