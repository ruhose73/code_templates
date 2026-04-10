/* eslint-disable no-magic-numbers */

// Auth configs
export const AUTH_BCRYPT_ROUNDS = parseInt(process.env.AUTH_BCRYPT_ROUNDS ?? '10', 10);
export const AUTH_REFRESH_TOKEN_BYTES = parseInt(process.env.AUTH_REFRESH_TOKEN_BYTES ?? '64', 10);
export const AUTH_REFRESH_TOKEN_DAYS = parseInt(process.env.AUTH_REFRESH_TOKEN_DAYS ?? '30', 10);
export const AUTH_MS_PER_DAY = 24 * 60 * 60 * 1000;
