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
export const artJobs=sqliteTable('art_jobs',{
 id:text('id').primaryKey(),
 ownerId:text('owner_id').notNull(),
 workspaceKey:text('workspace_key').notNull(),
 runpodId:text('runpod_id').notNull(),
 status:text('status').notNull(),
 prompt:text('prompt').notNull(),
 width:integer('width').notNull(),
 height:integer('height').notNull(),
 seed:integer('seed').notNull(),
 kind:text('kind').notNull().default('imagem'),
 duration:integer('duration'),
 fileId:text('file_id'),
 error:text('error'),
 createdAt:text('created_at').notNull(),
 updatedAt:text('updated_at').notNull(),
},table=>[index('idx_art_jobs_owner_created').on(table.ownerId,table.createdAt)]);
export const rateLimits=sqliteTable('rate_limits',{
 key:text('key').primaryKey(),
 windowStart:integer('window_start').notNull(),
 count:integer('count').notNull().default(0),
});
// Cache de 24 h das buscas de fundo verde (a Pixabay exige; poupa o limite da Pexels).
export const fundoVerdeBuscas=sqliteTable('fundo_verde_buscas',{
 chave:text('chave').primaryKey(),
 resposta:text('resposta').notNull(),
 criadoEm:integer('criado_em').notNull(),
});
// Login próprio por código no e-mail (lib/login-codigo.ts). O banco guarda só resumos (SHA-256) do código e da sessão.
export const usuarios=sqliteTable('usuarios',{
 id:text('id').primaryKey(),
 email:text('email').notNull().unique(),
 criadoEm:integer('criado_em').notNull(),
});
export const loginCodigos=sqliteTable('login_codigos',{
 email:text('email').primaryKey(),
 hash:text('hash').notNull(),
 expira:integer('expira').notNull(),
 tentativas:integer('tentativas').notNull().default(0),
});
export const sessoes=sqliteTable('sessoes',{
 hash:text('hash').primaryKey(),
 userId:text('user_id').notNull(),
 email:text('email').notNull(),
 expira:integer('expira').notNull(),
},t=>[index('idx_sessoes_user').on(t.userId)]);
