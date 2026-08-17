const Database = require("better-sqlite3");

const db = new Database("marriage.db");

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    telegram_id TEXT UNIQUE NOT NULL,

    type TEXT NOT NULL,

    first_name TEXT,
    last_name TEXT,
    username TEXT,

    age INTEGER,
    city TEXT,
    education TEXT,
    job TEXT,
    marital_status TEXT,
    religion TEXT,
    height TEXT,
    description TEXT,

    phone TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    groom_id INTEGER NOT NULL,
    bride_id INTEGER NOT NULL,

    status TEXT DEFAULT 'pending',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(groom_id) REFERENCES users(id),
    FOREIGN KEY(bride_id) REFERENCES users(id)
);
`);

function getUserByTelegramId(telegramId) {
  return db
    .prepare(
      `
            SELECT *
            FROM users
            WHERE telegram_id = ?
        `,
    )
    .get(String(telegramId));
}

function getUserById(id) {
  return db
    .prepare(
      `
            SELECT *
            FROM users
            WHERE id = ?
        `,
    )
    .get(id);
}

function createUser(data) {
  const result = db
    .prepare(
      `
            INSERT INTO users (
                telegram_id,
                type,
                first_name,
                last_name,
                username,
                age,
                city,
                education,
                job,
                marital_status,
                religion,
                height,
                description,
                phone
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
    )
    .run(
      String(data.telegram_id),
      data.type,
      data.first_name || "",
      data.last_name || "",
      data.username || "",
      data.age || null,
      data.city || "",
      data.education || "",
      data.job || "",
      data.marital_status || "",
      data.religion || "",
      data.height || "",
      data.description || "",
      data.phone || "",
    );

  return getUserById(result.lastInsertRowid);
}

function getAllUsers(type) {
  return db
    .prepare(
      `
            SELECT *
            FROM users
            WHERE type = ?
            ORDER BY id ASC
        `,
    )
    .all(type);
}

function getUserCount(type) {
  return db
    .prepare(
      `
            SELECT COUNT(*) AS count
            FROM users
            WHERE type = ?
        `,
    )
    .get(type).count;
}

function createRequest(groomId, brideId) {
  return db
    .prepare(
      `
            INSERT INTO requests (
                groom_id,
                bride_id,
                status
            )
            VALUES (?, ?, 'pending')
        `,
    )
    .run(groomId, brideId);
}

function getPendingRequest(groomId, brideId) {
  return db
    .prepare(
      `
            SELECT *
            FROM requests
            WHERE groom_id = ?
            AND bride_id = ?
            AND status = 'pending'
        `,
    )
    .get(groomId, brideId);
}

function getRequestById(requestId) {
  return db
    .prepare(
      `
            SELECT *
            FROM requests
            WHERE id = ?
        `,
    )
    .get(requestId);
}

function updateRequestStatus(requestId, status) {
  return db
    .prepare(
      `
            UPDATE requests
            SET status = ?
            WHERE id = ?
        `,
    )
    .run(status, requestId);
}

module.exports = {
  getUserByTelegramId,
  getUserById,
  createUser,
  getAllUsers,
  getUserCount,
  createRequest,
  getPendingRequest,
  getRequestById,
  updateRequestStatus,
};
