import {sql} from 'drizzle-orm';
import {sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const waitlist=sqliteTable('waitlist',{
 email:text('email').primaryKey(),
 consentVersion:text('consent_version').notNull().default('early-access-v1'),
 createdAt:text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
