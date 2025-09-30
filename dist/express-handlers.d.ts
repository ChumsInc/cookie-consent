import type { NextFunction, Request, Response } from 'express';
import type { ValidatedUser } from "chums-types";
import type { HasUUID } from "./types.js";
/**
 * cookieConsentHelper handles the following:
 *  - checks for Sec-GPC header and opts the user out of analytics and marketing if it is present
 *  - sets a "cookie_consent" cookie if Sec-GPC is present
 *  - renews a "cookie_consent" cookie if needed (with a new expiration date)
 */
export declare function cookieConsentHelper(req: Request, res: Response<unknown, HasUUID>, next: NextFunction): Promise<void>;
/**
 * Sets the "cookie_consent" cookie with an age of 400 days (400 days is the max allowed by Google Chrome)
 * @param res
 * @param uuid
 */
export declare function setConsentCookie(res: Response, uuid: string): void;
export declare const useCookieGPCHelper: () => typeof cookieConsentHelper;
export declare const postCookieConsent: (req: Request, res: Response<unknown, ValidatedUser>) => Promise<void>;
export declare const getCookieConsent: (req: Request, res: Response<unknown, ValidatedUser>) => Promise<void>;
