import type { MiddlewareFunction } from 'react-router';

import { trackPageView } from './openReplay';

export const openReplayRouterMiddleware: MiddlewareFunction = async (ctx, next) => {
    const result = await next();
    trackPageView(ctx.pattern, ctx.params);
    return result;
};