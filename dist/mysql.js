import { createPool, createConnection } from 'mysql2/promise';
const config = {
    connectionLimit: Number(process.env.MYSQL_POOL_LIMIT) || 5,
    host: process.env.MYSQL_SERVER || '',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USERNAME || '',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DB || '',
    namedPlaceholders: true,
};
export async function getConnection() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { connectionLimit, ...connectionConfig } = config;
    return createConnection({ ...connectionConfig });
}
export const mysql2Pool = createPool({ ...config });
