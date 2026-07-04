import type { MiddlewareFunction } from 'react-router';

import { trackNavigation } from './openReplay';

export const openReplayRouterMiddleware: MiddlewareFunction = async (ctx, next) => {
    const result = await next();
    trackNavigation(ctx.pattern, ctx.params);
    return result;
};