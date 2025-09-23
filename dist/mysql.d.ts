import { type Connection, type Pool } from 'mysql2/promise';
export type { Pool, QueryOptions, Connection, PoolConnection } from 'mysql2/promise';
export declare function getConnection(): Promise<Connection>;
export declare const mysql2Pool: Pool;
