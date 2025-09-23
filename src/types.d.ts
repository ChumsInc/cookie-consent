import type {JwtPayload} from "jsonwebtoken";

export interface GoogleJWTToken extends JwtPayload {
    email: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    given_name?: string;
    family_name?: string;
}
export interface JWTAuth {
    token: string|null,
}
