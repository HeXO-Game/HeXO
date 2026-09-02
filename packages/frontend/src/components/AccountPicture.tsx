import { cn } from "../utils/cn";

export default function AccountPicture({
    image,
    username,

    className,
}: Readonly<{
    username: string,
    image?: string | null,

    className?: string,
}>) {
    if (!image) {
        return (
            <div className={cn(`flex size-9 items-center justify-center rounded-full bg-sky-400/14 text-sm font-semibold text-sky-100`, className)}>
                {username.slice(0, 1).toUpperCase()}
            </div>
        );
    }

    return (
        <img
            src={image}
            alt={username}
            className={cn("size-9 rounded-full object-cover", className)}
        />
    );
}