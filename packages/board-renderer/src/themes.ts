import type { CellMarker, PlacedCell } from ".";
import { traceHexPath } from "./utils";

export type BoardThemeColors = Readonly<{
    background: string;
    grid: string;
    emphasisFill: string;
    emphasisStroke: string;
    emphasisShadow: string;
    originFill: string;
    originStroke: string;
    hoverFill: string;
    hoverStroke: string;
    label: string;
    highlightNeutral: string;
    highlightYellow: string;
    highlightBlue: string;
    highlightDot: string;
    highlightLineShadow: string;
    marker: Record<CellMarker, string>;
}>;

export type BoardCellRenderOptions = Readonly<{
    context: CanvasRenderingContext2D;
    cell: PlacedCell;
    centerX: number;
    centerY: number;
    radius: number;
    scale: number;
}>;

export type BoardTheme = Readonly<{
    colors: BoardThemeColors;
    drawCell: (options: BoardCellRenderOptions) => void;
}>;

const darkColors: BoardThemeColors = {
    background: `#0f172a`,
    grid: `rgba(148, 163, 184, 0.18)`,
    emphasisFill: `rgba(255, 255, 255, 0.12)`,
    emphasisStroke: `rgba(248, 250, 252, 0.96)`,
    emphasisShadow: `rgba(248, 250, 252, 0.52)`,
    originFill: `rgba(248, 211, 208, 0.12)`,
    originStroke: `rgba(248, 211, 208, 0.62)`,
    hoverFill: `rgba(125, 211, 252, 0.18)`,
    hoverStroke: `rgba(125, 211, 252, 0.55)`,
    label: `rgba(248, 250, 252, 0.96)`,
    highlightNeutral: `#f472b6`,
    highlightYellow: `#fbbf24`,
    highlightBlue: `#38bdf8`,
    highlightDot: `rgba(255, 255, 255, 0.92)`,
    highlightLineShadow: `rgba(15, 23, 42, 0.34)`,

    marker: {
        X: "#38bdf8",
        O: "#fbbf24",
    },
};

export const normalBoardTheme: BoardTheme = {
    colors: darkColors,
    drawCell: drawFilledCell,
};

export const markerBoardTheme: BoardTheme = {
    colors: darkColors,
    drawCell: drawMarkerCell,
};

export const blackAndWhiteBoardTheme: BoardTheme = {
    colors: {
        background: `#ffffff`,
        grid: `rgba(0, 0, 0, 0.18)`,
        emphasisFill: `rgba(0, 0, 0, 0.08)`,
        emphasisStroke: `rgba(0, 0, 0, 0.92)`,
        emphasisShadow: `rgba(0, 0, 0, 0.28)`,
        originFill: `rgba(0, 0, 0, 0.06)`,
        originStroke: `rgba(0, 0, 0, 0.48)`,
        hoverFill: `rgba(0, 0, 0, 0.08)`,
        hoverStroke: `rgba(0, 0, 0, 0.52)`,
        label: `#000000`,
        highlightNeutral: `#000000`,
        highlightYellow: `#555555`,
        highlightBlue: `#888888`,
        highlightDot: `#000000`,
        highlightLineShadow: `rgba(255, 255, 255, 0.72)`,
        marker: {
            X: "#555555",
            O: "#888888",
        },
    },
    drawCell: drawBlackAndWhiteCell,
};

function drawFilledCell({
    context,
    cell,
    centerX,
    centerY,
    radius,
}: BoardCellRenderOptions) {
    traceHexPath(context, centerX, centerY, radius - 2);
    context.fillStyle = cell.marker === "X" ? "#fbbf24" : "#38bdf8";
    context.fill();
}

function drawMarkerCell(options: BoardCellRenderOptions) {
    const { context, cell, centerX, centerY, radius, scale } = options;
    const palette = getMarkerPalette(
        cell.marker === "X" ? "#fbbf24" : "#38bdf8",
    );

    traceHexPath(context, centerX, centerY, radius - 2);
    context.fillStyle = palette.tileTint;
    context.fill();
    context.strokeStyle = palette.tileShadow;
    context.lineWidth = Math.max(2.5, scale * 0.09);
    context.stroke();

    traceHexPath(context, centerX, centerY, radius - 2);
    context.strokeStyle = palette.tileOutline;
    context.lineWidth = Math.max(1.6, scale * 0.055);
    context.stroke();

    drawMarker(options, {
        shadow: palette.markerShadow,
        outline: palette.markerOutline,
        fill: palette.markerFill,
        accent: palette.accent,
    });
}

function drawBlackAndWhiteCell(options: BoardCellRenderOptions) {
    const { context, cell, centerX, centerY, radius, scale } = options;
    traceHexPath(context, centerX, centerY, radius - 2);

    if (!cell.marker) {
        context.fillStyle = `#000000`;
        context.fill();
        return;
    }

    context.fillStyle = `#ffffff`;
    context.fill();
    context.strokeStyle = `#000000`;
    context.lineWidth = Math.max(1.5, scale * 0.055);
    context.stroke();
    drawMarker(options, { outline: `#000000`, fill: `#000000` });
}

type MarkerStyle = {
    shadow?: string;
    outline: string;
    fill: string;
    accent?: string;
};

function drawMarker(
    { context, cell, centerX, centerY, radius }: BoardCellRenderOptions,
    style: MarkerStyle,
) {
    if (!cell.marker) {
        return;
    }

    const markerRadius = Math.max(5, radius * 0.36);
    const lineWidth = Math.max(2.25, radius * 0.16);
    const traceMarker = cell.marker === `X` ? traceX : traceO;

    context.save();
    traceHexPath(context, centerX, centerY, Math.max(4, radius - 4));
    context.clip();
    context.lineCap = `round`;
    context.lineJoin = `round`;

    if (style.shadow) {
        context.save();
        context.translate(lineWidth * 0.14, lineWidth * 0.18);
        traceMarker(context, centerX, centerY, markerRadius);
        context.strokeStyle = style.shadow;
        context.lineWidth = lineWidth + Math.max(1.5, radius * 0.04);
        context.stroke();
        context.restore();
    }

    traceMarker(context, centerX, centerY, markerRadius);
    context.strokeStyle = style.outline;
    context.lineWidth = lineWidth + Math.max(0.75, radius * 0.02);
    context.stroke();
    traceMarker(context, centerX, centerY, markerRadius);
    context.strokeStyle = style.fill;
    context.lineWidth = Math.max(1.5, lineWidth * 0.7);
    context.stroke();

    if (style.accent) {
        traceMarker(context, centerX, centerY, markerRadius);
        context.strokeStyle = style.accent;
        context.lineWidth = Math.max(1, lineWidth * 0.34);
        context.stroke();
    }
    context.restore();
}

function traceX(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
) {
    context.beginPath();
    context.moveTo(centerX - radius, centerY - radius);
    context.lineTo(centerX + radius, centerY + radius);
    context.moveTo(centerX + radius, centerY - radius);
    context.lineTo(centerX - radius, centerY + radius);
}

function traceO(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
) {
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
}

type RgbColor = { r: number; g: number; b: number };

function getMarkerPalette(colorValue: string) {
    const color = parseHexColor(colorValue);
    if (!color) {
        return {
            tileTint: `rgba(255, 255, 255, 0.04)`,
            tileShadow: `rgba(15, 23, 42, 0.38)`,
            tileOutline: `rgba(226, 232, 240, 0.92)`,
            markerShadow: `rgba(15, 23, 42, 0.26)`,
            markerOutline: `rgba(15, 23, 42, 0.96)`,
            markerFill: `rgba(226, 232, 240, 0.98)`,
            accent: `rgba(255, 255, 255, 0.18)`,
        };
    }

    const slate900 = { r: 15, g: 23, b: 42 };
    const slate950 = { r: 2, g: 6, b: 23 };
    const white = { r: 255, g: 255, b: 255 };
    const luminance =
        (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
    return {
        tileTint: withAlpha(mixColor(color, white, 0.2), 0.08),
        tileShadow: withAlpha(mixColor(color, slate950, 0.8), 0.42),
        tileOutline: withAlpha(
            luminance > 0.72
                ? mixColor(color, slate900, 0.12)
                : mixColor(color, white, 0.06),
            0.98,
        ),
        markerOutline: withAlpha(
            mixColor(color, slate950, luminance > 0.62 ? 0.82 : 0.74),
            0.98,
        ),
        markerShadow: withAlpha(mixColor(color, slate950, 0.72), 0.28),
        markerFill: withAlpha(color, 0.98),
        accent: withAlpha(
            mixColor(color, white, luminance > 0.62 ? 0.22 : 0.38),
            luminance > 0.62 ? 0.18 : 0.22,
        ),
    };
}

function parseHexColor(color: string): RgbColor | null {
    const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());
    if (!match) return null;

    const value = match[1];
    if (value.length === 3) {
        return {
            r: Number.parseInt(`${value[0]}${value[0]}`, 16),
            g: Number.parseInt(`${value[1]}${value[1]}`, 16),
            b: Number.parseInt(`${value[2]}${value[2]}`, 16),
        };
    }
    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
    };
}

function mixColor(base: RgbColor, target: RgbColor, amount: number): RgbColor {
    return {
        r: mixChannel(base.r, target.r, amount),
        g: mixChannel(base.g, target.g, amount),
        b: mixChannel(base.b, target.b, amount),
    };
}

function mixChannel(base: number, target: number, amount: number) {
    return Math.max(
        0,
        Math.min(255, Math.round(base + (target - base) * amount)),
    );
}

function withAlpha(color: RgbColor, alpha: number) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}
