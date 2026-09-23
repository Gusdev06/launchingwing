import {sql} from 'drizzle-orm';
import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const waitlist=sqliteTable('waitlist',{
 email:text('email').primaryKey(),
 consentVersion:text('consent_version').notNull().default('early-access-v1'),
 createdAt:text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const pilotRuns=sqliteTable('pilot_runs',{
 id:text('id').primaryKey(),
 ownerId:text('owner_id').notNull(),
 data:text('data').notNull(),
 revision:integer('revision').notNull().default(0),
 createdAt:text('created_at').notNull(),
 updatedAt:text('updated_at').notNull(),
},table=>[index('idx_pilot_runs_owner_created').on(table.ownerId,table.createdAt)]);
