const db = require('./db');

async function runMigrations() {
  // bots
  await db.execute(`CREATE TABLE IF NOT EXISTS bots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NULL,
    token VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // add username column and unique index if missing (MySQL 8 supports IF NOT EXISTS)
  try { await db.execute(`ALTER TABLE bots ADD COLUMN IF NOT EXISTS username VARCHAR(255) NULL`); } catch (e) {}
  try { await db.execute(`ALTER TABLE bots ADD UNIQUE KEY IF NOT EXISTS uniq_username (username)`); } catch (e) {}

  // chats
  await db.execute(`CREATE TABLE IF NOT EXISTS chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bot_id INT NOT NULL,
    chat_id BIGINT NOT NULL,
    type VARCHAR(32) NULL,
    title VARCHAR(255) NULL,
    username VARCHAR(255) NULL,
    first_name VARCHAR(255) NULL,
    last_name VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uniq_bot_chat (bot_id, chat_id),
    INDEX idx_bot (bot_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // chat_members
  await db.execute(`CREATE TABLE IF NOT EXISTS chat_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bot_id INT NOT NULL,
    chat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    username VARCHAR(255) NULL,
    first_name VARCHAR(255) NULL,
    last_name VARCHAR(255) NULL,
    is_bot TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(64) NULL,
    joined_at DATETIME NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uniq_member (bot_id, chat_id, user_id),
    INDEX idx_chat (bot_id, chat_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // messages
  await db.execute(`CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bot_id INT NOT NULL,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    from_user_id BIGINT NULL,
    text TEXT NULL,
    raw LONGTEXT NULL,
    date INT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uniq_msg (bot_id, chat_id, message_id),
    INDEX idx_chat_msg (bot_id, chat_id, message_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

module.exports = { runMigrations };
