import { sql } from 'drizzle-orm';

export async function up(db) {
  await db.run(sql`
    CREATE TABLE message_reactions (
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      dao_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT message_reactions_unique UNIQUE (message_id, user_id, emoji),
      FOREIGN KEY (message_id) REFERENCES dao_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE
    );
    CREATE INDEX message_reactions_message_idx ON message_reactions(message_id);
    CREATE INDEX message_reactions_dao_idx ON message_reactions(dao_id);
  `);
}

export async function down(db) {
  await db.run(sql`DROP TABLE IF EXISTS message_reactions;`);
