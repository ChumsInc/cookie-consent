import type { NextFunction, Request, Response } from "express";
import type { ValidatedUser } from "chums-types";
export { consentCookieName } from './cookie-consent.js';
/**
 * cookieConsentHelper handles the following:
 *  - checks for Sec-GPC header and opts the user out of analytics and marketing if it is present
 *  - sets a "cookie_consent" cookie if Sec-GPC is present
 *  - renews a "cookie_consent" cookie if needed (with a new expiration date)
 */
export declare function cookieConsentHelper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare const postCookieConsent: (req: Request, res: Response<unknown, ValidatedUser>) => Promise<void>;
export declare const getCookieConsent: (req: Request, res: Response<unknown, ValidatedUser>) => Promise<void>;
