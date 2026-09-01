import type {
    BoardCellRenderOptions,
    BoardTheme,
    BoardThemeColors,
} from "../themes";
import { traceHexPath } from "../utils";
import { drawMarker } from "./markerDrawing";

const blackAndWhiteColors: BoardThemeColors = {
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
        X: `#555555`,
        O: `#888888`,
    },
};

export const blackAndWhiteBoardTheme: BoardTheme = {
    colors: blackAndWhiteColors,
    drawCell(options: BoardCellRenderOptions) {
        const { context, cell, centerX, centerY, radius, scale } = options;
        traceHexPath(context, centerX, centerY, radius - 2);
        context.fillStyle = `#ffffff`;
        context.fill();
        context.strokeStyle = `#000000`;
        context.lineWidth = Math.max(1.5, scale * 0.055);
        context.stroke();

        const markerColor = blackAndWhiteColors.marker[cell.marker];
        drawMarker(options, { outline: markerColor, fill: markerColor });
    },
};
