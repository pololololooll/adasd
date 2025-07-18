import 'dotenv/config';
import bcrypt from "bcrypt";
import { fileURLToPath } from "url";
import { writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { timingSafeEqual } from "crypto";

/**
 * @description root folder of project
 * @const
 */
export const FS_ROOT = dirname(fileURLToPath(import.meta.url));
/**
 * @description file name of the storage json file
 * @const
 */
export const STORAGE_FILE = "storage.json";

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
 * @param {Storage} storage
 */
export function saveStorage(storage) {
  try {
    writeFileSync(
      join(FS_ROOT, STORAGE_FILE),
      JSON.stringify(storage), 
    );
    log("INFO", `Saving storage to ${STORAGE_FILE}`);
  } catch (err) {
    log("ERROR", "Error while trying to save storage");
    log("ERROR", err);
  }
}

/**
 * @returns {Storage|null}
 */
export function readStorage() {
  try {
    const data = readFileSync(join(FS_ROOT, STORAGE_FILE), { encoding: "utf-8" });
    return JSON.parse(data);
  } catch (err) {
    log("ERROR", `Error while reading ${STORAGE_FILE}`);
    log("ERROR", err);
    return null;
  }
}
