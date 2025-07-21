import 'dotenv/config';
import bcrypt from "bcrypt";
import { timingSafeEqual } from "crypto";
import { Client } from "pg";
import { dirname } from "path";
import { fileURLToPath } from "url";

/**
 * @description root folder of project
 * @const
 */
export const FS_ROOT = dirname(fileURLToPath(import.meta.url));

/**
 * @param {Express.Request} req
 */
export function isAdmin(req) {
  const sID = req.cookies.sID;
  if (
    sID != null &&
    bcrypt.compareSync(`${process.env.GLOBAL_LOGIN}-|-${process.env.GLOBAL_PASS}`, sID)
  ) return true;
  return false;
}

/**
 * @param {Express} app
 * @param {string} path
 * @param {string} filePath
 * @param {boolean?} [adminOnly=false]
 * @param {string?} [redirect=/]
 */
export function fileEndpointGet(app, path, filePath, adminOnly = false, redirect = "/") {
  app.get(path, (req, res) => {
    if (adminOnly && !isAdmin(req)) { 
      if (!redirect) res.sendStatus(403);
      else res.redirect(redirect);
    } else {
      res.sendFile(filePath, { root: FS_ROOT });
    }
  });
}

/**
 * @param {any} a
 * @param {any} b
 * @returns boolean
 */
export function safeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length != bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * @param {"INFO"|"ERROR"} type
 * @param {string} message
 */
export function log(type, message) {
  const d = new Date()
  console.log(`[${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}] [${type}] ${message}`);
}

/**
 * @param {string} message
 */
export async function webhookLog(message) {
  await fetch(process.env.WEBHOOK_URL, {
    "method": "POST",
    "headers": { "Content-Type": "application/json" },
    "body": JSON.stringify({
      content: message,
      embeds: null,
      attachments: []
    })
  });
}

/**
 * @typedef Activity
 * @type {object}
 * @property {string} name
 * @property {number} price - w plnach
 * @property {number} cycle - w sekundach 
 * @property {number} time_left - w sekundach
 * @property {boolean} stopped
 */

/**
 * @typedef Offer
 * @type {object}
 * @property {string} name 
 * @property {number} price - w plnach
 */

/**
 * @typedef Storage
 * @type {object}
 * @property {Activity[]} activities
 * @property {Offer[]} offers
 */

/**
 * @returns {Promise<Client>}
 */
export async function initDB() {
  const client = new Client({
    connectionString: process.env.DB_URL
  });
  await client.connect();
  log("INFO", "Connected to db");
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS Storage (
      id SERIAL PRIMARY KEY,
      data JSONB
    )
  `);
  
  // Db is only so the JSON doesnt get reset by current hosting
  const res = await client.query("SELECT COUNT(*) FROM Storage");
  if (parseInt(res.rows[0].count) === 0)
    await client.query("INSERT INTO Storage (data) VALUES ({})");
  return client;
}

/**
 * @param {Client} client
 * @param {Storage} storage
 */
export async function saveStorage(client, storage) {
  try {
    await client.query("UPDATE Storage SET data=$1 WHERE id=1", [storage]);
    log("INFO", `Saving storage to DB`);
  } catch (err) {
    log("ERROR", "Error while trying to save storage");
    log("ERROR", err);
  }
}

/**
 * @param {Client} client
 * @returns {Promise<Storage|null>}
 */
export async function readStorage(client) {
  try {
    const res = await client.query("SELECT data FROM Storage where id=1");
    return res.rows[0].data;
  } catch (err) {
    log("ERROR", `Error while reading from DB`);
    log("ERROR", err);
    return null;
  }
}
