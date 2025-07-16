/**
 * @typedef Activity
 * @type {object}
 * @property {string} name
 * @property {number} price
 * @property {number} cycle
 * @property {number} time_left
 * @property {boolean} stopped
 */

const socket = io();
const activityContainer = document.querySelector(".grid");

const timers = {};
const endTimes = {};

function formatTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function updateEndTime(el, endTime) {
  const hours = String(endTime.getHours()).padStart(2, '0');
  const minutes = String(endTime.getMinutes()).padStart(2, '0');
  el.innerText = `Zakończy się o ${hours}:${minutes}`;
}

/** @param {Activity} activ */
function createActivityCard(activ) {
  const card = document.createElement("div");
  card.classList.add("card");
  card.id = `${activ.name}-card`;

  card.innerHTML = `
    <h2>${activ.name}</h2>
    <div class="timer" id="${activ.name}-timer">00:00:00</div>
    <div class="info" id="${activ.name}-end">Nie rozpoczęto</div>
  `;
  return card;
}

function startCountdown(id, timeLeft, stopped) {
  const timerElement = document.getElementById(`${id}-timer`);
  const endElement = document.getElementById(`${id}-end`);
  const endTime = new Date(Date.now() + timeLeft * 1000);
  endTimes[id] = endTime;

  updateEndTime(endElement, endTime);

  if (timers[id]) clearInterval(timers[id]);
  if (stopped) {
    timerElement.innerText = formatTime(Math.floor((endTimes[id] - Date.now()) / 1000));
    endElement.innerText = "Pauza";
    return;
  }  

  timers[id] = setInterval(() => {
    const diff = Math.floor((endTimes[id] - Date.now()) / 1000);
    if (diff <= 0) {
      clearInterval(timers[id]);
      timerElement.innerText = "00:00:00";
      endElement.innerText = "Zakończono";
      delete timers[id];
      delete endTimes[id];
    } else {
      timerElement.innerText = formatTime(diff);
    }
  }, 1000);
}

/** @param {Activity[]} activities */
function renderActivities(activities) {
  // console.log(activities)
  const existing = new Set();

  activities.forEach(activ => {
    const cardId = `${activ.name}-card`;
    existing.add(cardId);

    let card = document.getElementById(cardId);
    if (!card) {
      const newCard = createActivityCard(activ);
      activityContainer.appendChild(newCard);
    }

    if (timers[activ.name]) clearInterval(timers[activ.name]);
    if (activ.time_left > 0) {
      startCountdown(activ.name, activ.time_left, activ.stopped);
    } else {
      const timerEl = document.getElementById(`${activ.name}-timer`);
      const infoEl = document.getElementById(`${activ.name}-end`);
      if (timerEl) timerEl.innerText = "00:00:00";
      if (infoEl) infoEl.innerText = "Zakończono";
    }
  });

  Array.from(activityContainer.children).forEach(child => {
    if (
      child.classList.contains("card") &&
      child.id.endsWith("-card") &&
      !existing.has(child.id) &&
      !child.innerHTML.includes("Cennik")
    ) {
      child.remove();
    }
  });
}

function updatePriceList(activities) {
  const tbody = document.getElementById("cennik").querySelector("tbody");
  tbody.innerHTML = "";
  for (const activ of activities) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${activ.name}</td><td>${activ.price} zł</td><td>${activ.cycle / 60} min</td>`;
    tbody.appendChild(tr);
  }
}

socket.on("init", (activities) => {
  renderActivities(activities);
  updatePriceList(activities);
});

socket.on("timerUpdate", (activities) => {
  renderActivities(activities);
  updatePriceList(activities);
});
