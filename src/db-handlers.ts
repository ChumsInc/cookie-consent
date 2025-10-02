import Debug from "debug";
import type {CookieConsentChange, CookieConsentRecord, CookieConsentSettings} from "chums-types";
import {mysql2Pool} from "./mysql.js";
import dayjs from 'dayjs'
import type {ResultSetHeader, RowDataPacket} from "mysql2";
import {randomUUID} from "node:crypto";
import type {CookieConsentRow, LoadCookieConsentProps, SaveCookieConsentProps, SaveGPCOptOutProps} from "./types.js";
import {verbose} from "./settings.js";

const debug = Debug('chums:cookie-consent:db-handlers');

/**
 * Saves an opt-out record for the user
 *  - if the user already has a cookie consent record, it will be updated to set gpc = true and record the change
 *  - if the user does not have a cookie consent record, it will be created and set to gpc = true
 *
 * @param props
 */
export async function saveGPCOptOut(props: SaveGPCOptOutProps): Promise<CookieConsentRecord | null> {
    try {
        if (verbose) debug("saveGPCOptOut()", props);
        const record = await loadCookieConsent({uuid: props.uuid});
        if (record?.gpc) {
            return record;
        }
        if (!record) {
            return await saveCookieConsent({
                ...props,
                ack: false,
                action: {
                    accepted: ['functional', 'preferences'],
                    rejected: ['marketing', 'analytics'],
                    url: props.url,
                    method: 'header:sec-gpc'
                },
                gpc: true,
            })
        }
        const change: CookieConsentChange = {
            accepted: record.preferences.preferences ? ['functional', 'preferences'] : ['functional'],
            rejected: ['marketing', 'analytics'],
            url: props.url,
            timestamp: new Date().toISOString(),
            method: 'header:sec-gpc'
        }
        const sql = `UPDATE users.cookieConsentLog
                     SET gpc         = :gpc,
                         preferences = :preferences,
                         changes     = :changes
                     WHERE uuid = :uuid`;
        const data = {
            uuid: props.uuid,
            gpc: true,
            preferences: JSON.stringify({
                functional: record.preferences.functional ?? true,
                preferences: record.preferences.preferences ?? true,
                analytics: false,
                marketing: false,
            }),
            changes: JSON.stringify([...record.changes, change]),
        }
        if (verbose) debug("saveGPCOptOut() - updating cookie consent record", data);
        await mysql2Pool.query(sql, data);
        return await loadCookieConsent({uuid: props.uuid});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("gpcOptOutUser()", err.message);
            return Promise.reject(err);
        }
        debug("gpcOptOutUser()", err);
        return Promise.reject(new Error('Error in gpcOptOutUser()'));
    }
}

export async function updateUserId(uuid: string, userId: string|number): Promise<CookieConsentRecord | null> {
    try {
        const sql = `UPDATE users.cookieConsentLog
                     SET userId = :userId
                     WHERE uuid = :uuid`;
        const data = {
            uuid: uuid,
            userId: userId
        }
        if (verbose) debug("updateUserId()", data);
        await mysql2Pool.query(sql, data);
        return await loadCookieConsent({uuid});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("updateUserId()", err.message);
            return Promise.reject(err);
        }
        debug("updateUserId()", err);
        return Promise.reject(new Error('Error in updateUserId()'));
    }
}


export async function loadUserIdFromEmail(email: string): Promise<number | null> {
    const sql = `SELECT id
                 FROM users.users
                 WHERE email = :email`;
    const data = {email: email}
    const [rows] = await mysql2Pool.query<RowDataPacket[]>(sql, data);
    if (rows.length === 0) {
        return null;
    }
    return rows[0].id;
}

/**
 * Saves a cookie consent record for the user
 *  - if the user already has a cookie consent record, it will be updated to record the change
 *  - if the user does not have a cookie consent record, it will be created
 *
 */
export async function saveCookieConsent({
                                            uuid,
                                            userId,
                                            url,
                                            ack,
                                            ipAddress,
                                            action,
                                            gpc
                                        }: SaveCookieConsentProps): Promise<CookieConsentRecord | null> {
    try {
        const sqlInsert = `INSERT INTO users.cookieConsentLog (uuid, userId, url, ipAddress,
                                                               ack, preferences, gpc, changes,
                                                               status, dateExpires)
                           VALUES (:uuid, :userId, :url, :ipAddress, :ack, :preferences, :gpc, :changes, :status,
                                   DATE_ADD(NOW(), INTERVAL 1 YEAR))`;
        const sqlUpdate = `UPDATE users.cookieConsentLog
                           SET userId      = :userId,
                               ipAddress   = :ipAddress,
                               ack         = :ack,
                               preferences = :preferences,
                               gpc         = :gpc,
                               changes     = :changes,
                               status      = :status,
                               dateExpires = DATE_ADD(NOW(), INTERVAL 1 YEAR)
                           WHERE uuid = :uuid`;

        let consent: CookieConsentRecord | null = null;
        const preferences: CookieConsentSettings = {
            functional: true,
            preferences: action.accepted.includes('preferences'),
            analytics: action.accepted.includes('analytics'),
            marketing: action.accepted.includes('marketing'),
        };
        const changes: CookieConsentChange[] = [];
        if (uuid) {
            consent = await loadCookieConsent({uuid});
            if (consent) {
                changes.push(...consent.changes);
            }
        }
        changes.push({
            ...action,
            url: action.url ?? url,
            timestamp: new Date().toISOString()
        });

        const data = {
            uuid: consent?.uuid ?? randomUUID(),
            url: url,
            userId: consent?.userId ?? userId,
            ipAddress: ipAddress,
            ack: ack ?? false,
            preferences: JSON.stringify(preferences),
            changes: JSON.stringify(changes),
            status: getPreferencesStatus(preferences),
            gpc: gpc ?? consent?.gpc ?? false,
        }
        if (verbose) debug("saveCookieConsent()", data);
        if (consent?.uuid) {
            await mysql2Pool.query(sqlUpdate, data);
            return await loadCookieConsent({uuid: consent!.uuid});
        }
        const [status] = await mysql2Pool.query<ResultSetHeader>(sqlInsert, data);
        return await loadCookieConsent({id: status.insertId});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("saveCookieConsent()", err.message);
            return Promise.reject(err);
        }
        debug("saveCookieConsent()", err);
        return Promise.reject(new Error('Error in saveCookieConsent()'));
    }
}

/**
 * Updates the cookie consent record for the user to a current expiration date
 *  - the expiration date is not normally checked but is there for audit purposes
 * @param uuid
 */
export async function extendCookieConsentExpiry(uuid: string): Promise<CookieConsentRecord | null> {
    try {
        const sql = `UPDATE users.cookieConsentLog
                     SET dateExpires = DATE_ADD(NOW(), INTERVAL 1 YEAR)
                     WHERE uuid = :uuid`;
        const data = {uuid: uuid}
        if (verbose) debug("extendCookieConsentExpiry()", data);
        await mysql2Pool.query(sql, data);
        return await loadCookieConsent({uuid});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("extendCookieConsentExpiry()", err.message);
            return Promise.reject(err);
        }
        debug("extendCookieConsentExpiry()", err);
        return Promise.reject(new Error('Error in extendCookieConsentExpiry()'));
    }
}

/**
 * Checks if the cookie consent record is more than 30 days old, and therefore should be extended
 * @param consent
 */
export function shouldExtendCookieConsent(consent: CookieConsentRecord): boolean {
    return dayjs(consent.dateExpires).diff(dayjs(), 'day') > 30;
}

/**
 * Loads a cookie consent record for the user by id, uuid, or userId
 */
export async function loadCookieConsent(props: LoadCookieConsentProps): Promise<CookieConsentRecord | null> {
    try {
        if (!props.uuid && !props.id && !props.userId) {
            return null;
        }
        const sql = `SELECT uuid,
                            userId,
                            url,
                            ipAddress,
                            ack,
                            JSON_EXTRACT(preferences, '$')           AS preferences,
                            JSON_EXTRACT(IFNULL(changes, '[]'), '$') AS changes,
                            gpc,
                            status,
                            dateCreated,
                            dateUpdated
                     FROM users.cookieConsentLog
                     WHERE id = :id
                        OR uuid = :uuid
                        OR userId = :userId
                     LIMIT 1`;
        const args = {
            id: props.id ?? null,
            uuid: props.uuid ?? null,
            userId: props.userId ?? null,
        }
        if (verbose) debug("loadCookieConsent()", args);
        const [rows] = await mysql2Pool.query<CookieConsentRow[]>(sql, args);
        if (rows.length === 0) {
            return null;
        }
        const row = rows[0];
        if (dayjs(row.dateUpdated).diff(dayjs(), 'month') >= 6) {
            row.ack = 0;
        }
        return {
            ...row,
            ack: !!row.ack,
            preferences: JSON.parse(row.preferences),
            gpc: !!row.gpc,
            changes: JSON.parse(row.changes),
        }
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadCookieConsent()", err.message);
            return Promise.reject(err);
        }
        debug("loadCookieConsent()", err);
        return Promise.reject(new Error('Error in loadCookieConsent()'));
    }
}

/**
 * Returns the status of the preferences based on the preferences
 *  - if all preferences are accepted, the status is "accepted"
 *  - if all preferences are rejected, the status is "rejected"
 *  - if some preferences are accepted and some are rejected, the status is "partial"
 */
function getPreferencesStatus(preferences: CookieConsentSettings): string {
    if (preferences.functional && preferences.preferences && preferences.analytics && preferences.marketing) {
        return 'accepted';
    }
    if (!(preferences.functional || preferences.preferences || preferences.analytics || preferences.marketing)) {
        return 'rejected';
    }
    return 'partial'
}
