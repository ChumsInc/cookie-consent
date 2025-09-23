import type { NextFunction, Request, Response } from 'express';
import type { CookieConsentChange, CookieConsentRecord } from "chums-types";
/**
 * A globally accessible name for the cookie that stores the cookie consent uuid
 */
export declare const consentCookieName = "cookie_consent";
/**
 * Sets the "cookie_consent" cookie with an age of 400 days (400 days is the max allowed by Google Chrome)
 * @param res
 * @param uuid
 */
export declare function setConsentCookie(res: Response, uuid: string): void;
/**
 * cookieConsentHelper handles the following:
 *  - checks for Sec-GPC header and opts the user out of analytics and marketing if it is present
 *  - sets a "cookie_consent" cookie if Sec-GPC is present
 *  - renews a "cookie_consent" cookie if needed (with a new expiration date)
 */
export declare function cookieConsentHelper(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Saves an opt-out record for the user
 *  - if the user already has a cookie consent record, it will be updated to set gpc = true and record the change
 *  - if the user does not have a cookie consent record, it will be created and set to gpc = true
 *
 * @param props
 */
export declare function saveOptOutUser(props: SaveOptOutUserProps): Promise<CookieConsentRecord | null>;
export declare function loadUserIdFromEmail(email: string): Promise<number | null>;
/**
 * Saves a cookie consent record for the user
 *  - if the user already has a cookie consent record, it will be updated to record the change
 *  - if the user does not have a cookie consent record, it will be created
 *
 */
export declare function saveCookieConsent({ uuid, userId, url, ipAddress, action, gpc }: SaveCookieConsentProps): Promise<CookieConsentRecord | null>;
/**
 * Updates the cookie consent record for the user to a current expiration date
 *  - the expiration date is not normally checked but is there for audit purposes
 * @param uuid
 */
export declare function extendCookieConsentExpiry(uuid: string): Promise<CookieConsentRecord | null>;
/**
 * Checks if the cookie consent record is more than 30 days old, and therefore should be extended
 * @param consent
 */
export declare function shouldExtendCookieConsent(consent: CookieConsentRecord): boolean;
/**
 * Loads a cookie consent record for the user by id, uuid, or userId
 */
export declare function loadCookieConsent(props: LoadCookieConsentProps): Promise<CookieConsentRecord | null>;
export interface LoadCookieConsentProps extends Partial<Pick<CookieConsentRecord, 'uuid' | 'userId'>> {
    id?: number | null;
}
export interface SaveCookieConsentProps extends Pick<CookieConsentRecord, 'ipAddress' | 'url'>, Partial<Pick<CookieConsentRecord, 'uuid' | 'gpc'>> {
    userId?: number | null;
    action: Omit<CookieConsentChange, 'url' | 'timestamp'> & Partial<Pick<CookieConsentChange, 'url'>>;
}
export type SaveOptOutUserProps = Pick<SaveCookieConsentProps, 'uuid' | 'userId' | 'url' | 'ipAddress'>;
