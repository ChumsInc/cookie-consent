import type {JwtPayload} from "jsonwebtoken";
import type {CookieConsentChange, CookieConsentRecord} from "chums-types";
import type {RowDataPacket} from "mysql2";

export interface GoogleJWTToken extends JwtPayload {
    email: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    given_name?: string;
    family_name?: string;
}

export interface JWTAuth {
    token: string | null,
}


export interface LoadCookieConsentProps extends Partial<Pick<CookieConsentRecord, 'uuid' | 'userId'>> {
    id?: number | null;
}

export interface SaveCookieConsentProps extends Pick<CookieConsentRecord, 'ipAddress' | 'url'>, Partial<Pick<CookieConsentRecord, 'uuid' | 'gpc' | 'ack'>> {
    userId?: number | string | null;
    action: Omit<CookieConsentChange, 'url' | 'timestamp'> & Partial<Pick<CookieConsentChange, 'url'>>
}

export interface CookieConsentRow extends Omit<CookieConsentRecord, 'preferences' | 'changes' | 'gpc' | 'ack'>, RowDataPacket {
    preferences: string;
    changes: string;
    gpc: number;
    ack: number;
}

export type SaveGPCOptOutProps = Pick<SaveCookieConsentProps, 'uuid' | 'userId' | 'url' | 'ipAddress'>

export interface HasUUID {
    uuid?: string
}

export interface CookieConsentOptions {
    cookieName?: string;
    verbose?: boolean;
}
