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
 * @param {Express.Request} req
 */
export function isAdmin(req) {
  const sID = req.cookies.sID;
  if (
    sID != null &&
    bcrypt.compareSync(`${process.env.GLOBAL_LOGIN}-|-${process.env.GLOBAL_PASS}`, sID)
  ) {
    return true;
  } else {
    return false;
  }
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
  console.log(`[${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}] [${type}] ${message}`);
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
 * @param {Activity[]} activities
 */
export function saveActivities(activities) {
  try {
    writeFileSync(
      join(root, "czynnosci.json"),
      JSON.stringify(activities), 
    );
    log("INFO", "Saving activities to czynnosci.json.");
  } catch (err) {
    log("ERROR", err);
  }
}

/**
 * @returns {Activity[]|null}
 */
export function readActivities() {
  try {
    const data = readFileSync(join(FS_ROOT, "czynnosci.json"), { encoding: "utf-8" });
    return JSON.parse(data);
  } catch (err) {
    log("ERROR", "Error while reading czynnosci.json");
    log("ERROR", err);
    return null;
  }
}
