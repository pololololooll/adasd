import 'dotenv/config';
import * as util from "./utils.js";
import express from "express";
import http from "http";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";

const PORT = 3001;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
const server = http.createServer(app);
const io = new Server(server);

// Normal user resources
util.fileEndpointGet(app, "/", "views/index.html");
util.fileEndpointGet(app, "/style.css", "views/style.css");
util.fileEndpointGet(app, "/script.js", "views/script.js");
util.fileEndpointGet(app, "/login", "views/login.html");

// Admin resources 
util.fileEndpointGet(app, "/admin", "views/admin.html", true, "/login");
util.fileEndpointGet(app, "/admin.js", "views/admin.js", true, null);

app.post("/login", (req, res) => {
  if (
    !util.safeCompare(req.body?.nick || "a", process.env.GLOBAL_LOGIN) ||
    !util.safeCompare(req.body?.password || "a", process.env.GLOBAL_PASS)
  ) return res.redirect("/login");

  res.cookie(
    'sID', 
    bcrypt.hashSync(`${process.env.GLOBAL_LOGIN}-|-${process.env.GLOBAL_PASS}`, 4), 
    {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 60 * 1000
    }
  );
  res.redirect("/admin");
});

const activities = util.readActivities();
app.post("/api/activity", (req, res) => {
  if (!util.isAdmin(req)) return res.sendStatus(403);
  if (!req.body || !req.body.name || !req.body.price || !req.body.cycle)
    return res.send({ msg: "Niepoprawne zapytanie (Czy wszystkie pola są uzupełnione?)" });

  if (activities.map(a => a.name).includes(req.body.name)) {
    const idx = activities.findIndex(a => a.name == req.body.name);
    activities[idx].price = req.body.price;
    activities[idx].cycle = req.body.cycle;
    res.send({ msg: "Pomyślnie zmieniono aktywność" });
  } else {
    activities.push({
      name: req.body.name,
      price: req.body.price,
      cycle: req.body.cycle,
      time_left: 0,
      stopped: false
    });
    res.send({ msg: "Pomyślnie dodano aktywność" });
  }
  io.sockets.emit("timerUpdate", activities);
  util.saveActivities();
});

app.post("/api/timer", (req, res) => {
  if (!util.isAdmin(req)) return res.sendStatus(403);
  const idx = activities.findIndex(a => a.name == req?.body?.name);
  if (!req.body || !req.body.action || !req.body.name || idx === undefined)
    return res.send({ msg: "Nieprawidłowe zapytanie" });

  const activ = activities[idx];
  switch (req.body.action) {
    case "extend":
      activities[idx].time_left += activ.cycle;
      break;
    case "pause":
      activities[idx].stopped = !activ.stopped;
      break;
    case "shorten":
      activities[idx].time_left = Math.max(activ.time_left - activ.cycle, 0);
      break;
    case "zero":
      activities[idx].time_left = 0;
      break;
    case "delete":
      activities.splice(idx, 1);
      break;
    default:
      res.send({ msg: "Nieprawidłowe zapytanie" });
      return;
  }
  res.send({ msg: "Pomyślnie zmieniono "});
  io.sockets.emit("timerUpdate", activities);
  util.saveActivities();
});

io.on("connection", (sock) => {
  sock.emit("init", activities);
});

// Decrement every activity's timer each second
setInterval(() => {
  for (let i = 0; i < activities.length; i++) {
    if (activities[i].time_left == 0 || activities[i].stopped) continue;
    activities[i].time_left -= 1;
  }
}, 1000);

// Sync all clients every minute and backup activities
setInterval(() => {
  io.sockets.emit("timerUpdate", activities);
  util.saveActivities();
}, 60_000);

server.listen(PORT, () => {
  util.log("INFO", `Listening on ::${PORT}`);
});
