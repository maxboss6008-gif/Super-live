// Sample values — once you give final pricing, only this file needs to change
export const FREE_MESSAGES_PER_DAY = 20; // free messages per day
export const MESSAGE_COST_COINS = 1;     // cost per message after that
export const CALL_RATE_MIN = 10;         // bounds on the host-set call rate (coins/minute)
export const CALL_RATE_MAX = 1000;
export const CALL_RATE_DEFAULT = 60;
export type Feature = "messages" | "calls";
