export function normalizeSandboxPositionId(value: string | null | undefined) {
    const normalizedValue = value?.trim().toLowerCase() ?? ``;
    return /^[a-z0-9]{7}$/.test(normalizedValue) ? normalizedValue : null;
}

export function extractSandboxPositionId(value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return null;
    }

    try {
        const url = new URL(trimmedValue);
        const pathSegments = url.pathname.split(`/`).filter(Boolean);
        if (pathSegments[0] === `sandbox` && pathSegments[1]) {
            return normalizeSandboxPositionId(pathSegments[1]);
        }
    } catch {
        // Fall back to treating the input as a raw position id.
    }

    return normalizeSandboxPositionId(trimmedValue);
}

