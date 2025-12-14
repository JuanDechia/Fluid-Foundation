import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * SECURITY FIX: Secure by Default
 * 
 * We define ONLY what is public. Everything else is protected automatically.
 */
const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/webhooks(.*)', // External services need access
    '/api/public(.*)'    // Intentionally public APIs
]);

export default clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) {
        // This locks the door for every route not listed above
        const authObj = await auth();
        await authObj.protect();
    }
});

export const config = {
    matcher: [
        // Standard Next.js matcher: Intercepts everything except static assets
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
};
