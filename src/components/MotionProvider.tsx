"use client";

import { LazyMotion, domAnimation } from "framer-motion";
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

type MotionProviderProps = {
	children: ReactNode;
};

export function MotionProvider({ children }: MotionProviderProps) {
	return (
		<LazyMotion features={domAnimation}>
			<MotionConfig reducedMotion="user">{children}</MotionConfig>
		</LazyMotion>
	);
}
