/**
 * A globally accessible name for the cookie that stores the cookie consent uuid
 */
export const consentCookieName = process.env.COOKIE_CONSENT_NAME ?? 'cookie_consent';
export const defaultCookieOptions = {
    httpOnly: true,
    signed: true,
    maxAge: 400 * 60 * 60 * 24 * 400,
    sameSite: 'strict',
    secure: true
};
export const verbose = process.env.DEBUG_VERBOSE === 'true';
