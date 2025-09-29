import type { CookieConsentRecord } from "chums-types";
import type { LoadCookieConsentProps, SaveCookieConsentProps, SaveGPCOptOutProps } from "./types.js";
/**
 * Saves an opt-out record for the user
 *  - if the user already has a cookie consent record, it will be updated to set gpc = true and record the change
 *  - if the user does not have a cookie consent record, it will be created and set to gpc = true
 *
 * @param props
 */
export declare function saveGPCOptOut(props: SaveGPCOptOutProps): Promise<CookieConsentRecord | null>;
export declare function loadUserIdFromEmail(email: string): Promise<number | null>;
/**
 * Saves a cookie consent record for the user
 *  - if the user already has a cookie consent record, it will be updated to record the change
 *  - if the user does not have a cookie consent record, it will be created
 *
 */
export declare function saveCookieConsent({ uuid, userId, url, ack, ipAddress, action, gpc }: SaveCookieConsentProps): Promise<CookieConsentRecord | null>;
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
