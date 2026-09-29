import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageContainerProps {
    children: ReactNode;
    className?: string;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
    animate?: boolean;
}

export function PageContainer({
    children,
    className,
    maxWidth = "2xl",
    animate = true,
}: PageContainerProps) {
    const maxWidthClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
        full: "max-w-full",
    };

    return (
        <div
            className={cn(
                "mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8",
                maxWidthClasses[maxWidth],
                animate && "animate-fade-in",
                className
            )}
        >
            {children}
        </div>
    );
}
