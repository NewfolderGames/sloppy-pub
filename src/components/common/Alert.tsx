import React from "react";
import styles from "./Alert.module.css";

export interface AlertProps {
	variant?: "error" | "success" | "info";
	children: React.ReactNode;
	className?: string;
}

export const Alert: React.FC<AlertProps> = ({
	variant = "info",
	children,
	className,
}) => {
	const variantClass = styles[variant] || styles.info;
	const combinedClassName = [styles.alert, variantClass, className]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={combinedClassName} role="alert">
			{children}
		</div>
	);
};
