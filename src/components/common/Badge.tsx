import React from "react";
import styles from "./Badge.module.css";

export interface BadgeProps {
	variant?: "default" | "active" | "synchronized" | "isolated";
	children: React.ReactNode;
	className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
	variant = "default",
	children,
	className,
}) => {
	const variantClass = variant !== "default" ? styles[variant] : undefined;
	const combinedClassName = [styles.badge, variantClass, className]
		.filter(Boolean)
		.join(" ");

	return (
		<span className={combinedClassName}>
			{children}
		</span>
	);
};
