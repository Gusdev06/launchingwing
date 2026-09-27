import {sql} from 'drizzle-orm';
import {sqliteTable,text,integer,index,primaryKey,blob} from 'drizzle-orm/sqlite-core';
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
export const workspaces=sqliteTable('workspaces',{
 ownerId:text('owner_id').notNull(),
 key:text('key').notNull(),
 data:text('data').notNull(),
 revision:integer('revision').notNull().default(0),
 createdAt:text('created_at').notNull(),
 updatedAt:text('updated_at').notNull(),
},table=>[primaryKey({columns:[table.ownerId,table.key]})]);
export const workspaceFiles=sqliteTable('workspace_files',{
 id:text('id').primaryKey(),
 ownerId:text('owner_id').notNull(),
 workspaceKey:text('workspace_key').notNull(),
 name:text('name').notNull(),
 mime:text('mime').notNull(),
 size:integer('size').notNull(),
 chunks:integer('chunks').notNull(),
 createdAt:text('created_at').notNull(),
},table=>[index('idx_workspace_files_owner_key').on(table.ownerId,table.workspaceKey)]);
export const workspaceFileChunks=sqliteTable('workspace_file_chunks',{
 fileId:text('file_id').notNull(),
 seq:integer('seq').notNull(),
 bytes:blob('bytes',{mode:'buffer'}).notNull(),
},table=>[primaryKey({columns:[table.fileId,table.seq]})]);
