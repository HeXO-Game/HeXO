import { BugIcon } from "lucide-react";
import { Button } from "../components/ui/button";

export default function DebugButtonsRoute() {
    const sizes = [
        "xl",
        "lg",
        "default",
        "sm",
        "xs",
        "xxs",

        "icon",
        "icon-lg",
        "icon-sm",
        "icon-xl",

        "bare",
    ] as const;
    const variants = [
        "default",
        "secondary",

        "warning",

        "destructive",
        "destructive-soft",

        "success",
        "success-soft",

        "muted",
        "outline",
        "link",

        "card",
        "discord",
        "filter",
        "ghost",
        "info",
        "switch",
        "tab",
        "violet",
    ] as const;


    return (
        <div className={`p-3 gap-2 grid grid-cols-[repeat(12,1fr)] overflow-auto`}>
            <div />
            {
                sizes.map(size => (
                    <div>{size}</div>
                ))
            }
            {
                variants.map(variant => [
                    <div>{variant}</div>,
                    ...sizes.map(size => (
                        <div className={"w-48 h-20 bg-gray-700/20 rounded-md p-1 flex flex-col justify-center"}>
                            <Button key={`${size}-${variant}`} size={size} variant={variant} className={"self-center"}>
                                {size.includes("icon") ? (
                                    <BugIcon />
                                ) : (
                                    "Lorem Ipsum"
                                )}
                            </Button>
                        </div>
                    ))
                ])
            }
        </div>
    )
}