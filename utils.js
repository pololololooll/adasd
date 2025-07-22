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
 * @param {Activity} activity
 * @returns {string}
 */
export function timerTemplate(activity) {
  return `
  <!DOCTYPE html>
  <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1.0"</head>
    </body>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        html, body {
          margin: 0;
          padding: 0;
          width: 100vw;
          height: 100vh;
          background: transparent;
          font-family: 'Inter', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #card {
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 2vh 2vw;
          border: 1px solid rgba(255, 255, 255, 0.15);
          width: 90%;
          max-width: 100%;
          box-sizing: border-box;
        }
        #header {
          font-size: 5vh;
          margin: 0 0 0.2vh;
          color: white;
        }
        .timer {
          font-size: 6vh;
          font-weight: bold;
          color: #f00317;
          margin-bottom: 1vh;
        }
        .info {
          font-size: 2.5vh;
          color: #ccc;
        }
      </style>
      <div id="card">
        <h2 id="header">${activity.name}</h2>
        <div class="timer">00:00:00</div>
        <div class="info">Nie rozpoczęto</div>
      </div>
      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        const timerEl = document.querySelector(".timer");
        const infoEl = document.querySelector(".info");
        let interval;
        function formatTime(seconds) {
          const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
          const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
          const s = (seconds % 60).toString().padStart(2, '0');
          return \`\${h}:\${m}:\${s}\`;
        }
        function render(data) {
          clearInterval(interval);
          const endTime = new Date(Date.now() + data.time_left * 1000);
          if (data.stopped) {
            timerEl.innerText = formatTime(Math.floor((endTime - Date.now()) / 1000));
            infoEl.innerText = "Pauza";
            return;
          }
          if (data.time_left > 0) {
            interval = setInterval(() => {
              const diff = Math.floor((endTime - Date.now()) / 1000);
              if (diff <= 0) {
                clearInterval(interval);
                timerEl.innerText = "00:00:00";
                infoEl.innerText = "Zakończono";
              } else {
                infoEl.innerText = \`Zakończy się o \${endTime.getHours().toString().padStart(2, '0')}:\${endTime.getMinutes().toString().padStart(2, '0')}\`;
                timerEl.innerText = formatTime(diff);
              }
            }, 1000);
          } else {
            timerEl.innerText = "00:00:00";
            infoEl.textContent = "Zakończono";
          }
        }
        socket.on("init", (s) => render(s.activities[s.activities.findIndex(a => a.name == "${activity.name}")]));
        socket.on("update", (s) => render(s.activities[s.activities.findIndex(a => a.name == "${activity.name}")]));
      </script>
    </body>
  </html>
  `;
}


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
      data JSONB,
      streamer text
    )
  `);
  
  // Db is only so the JSON doesnt get reset by current hosting
  const res = await client.query("SELECT COUNT(*) FROM Storage where streamer='taku'");
  if (parseInt(res.rows[0].count) === 0)
    await client.query("INSERT INTO Storage (data, streamer) VALUES ($1, $2)", [{ activities: [], offers: [] }, 'taku']);
  return client;
}

/**
 * @param {Client} client
 * @param {Storage} storage
 */
export async function saveStorage(client, storage) {
  try {
    await client.query("UPDATE Storage SET data=$1 WHERE streamer='taku'", [storage]);
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
    const res = await client.query("SELECT data FROM Storage where streamer='taku'");
    return res.rows[0].data;
  } catch (err) {
    log("ERROR", `Error while reading from DB`);
    log("ERROR", err);
    return null;
  }
}
