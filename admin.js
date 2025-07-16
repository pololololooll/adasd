const form = document.getElementById("activity-form");
const tableBody = document.getElementById("activity-list");
const timers = {};

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(form);
  const name = formData.get("name");
  const price = Number(formData.get("price"));
  const cycle = Number(formData.get("cycle")) * 60;

  await fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, cycle }),
  })
    .then(res => res.json())
    .then(data => data?.msg ? alert(data.msg) : null);
});

function startCountdown(id, timeLeft, stopped) {
  const timerElement = document.getElementById(`${id}-timer`);
  const endTime = new Date(Date.now() + timeLeft * 1000);

  if (timers[id]) clearInterval(timers[id]);
  if (stopped) {
    timerElement.innerText = formatTime(Math.floor((endTime - Date.now()) / 1000));
    return;
  }  

  timers[id] = setInterval(() => {
    const diff = Math.floor((endTime - Date.now()) / 1000);
    if (diff <= 0) {
      clearInterval(timers[id]);
      timerElement.innerText = "00:00:00";
      delete timers[id];
    } else {
      timerElement.innerText = formatTime(diff);
    }
  }, 1000);
}


function renderTable(activities) {
  tableBody.innerHTML = "";
  for (const act of activities) {
    const tr = document.createElement("tr");
    tr.classList.add("activity-row");
    tr.innerHTML = `
      <td>${act.name}</td>
      <td>${act.price}</td>
      <td>${Math.floor(act.cycle / 60)} min</td>
      <td id="${act.name}-timer">${formatTime(act.time_left)}</td>
      <td>
        <button title="Przedłuż" onclick="control('${act.name}', 'extend')">➕</button>
        <button title="Zastopuj" onclick="control('${act.name}', 'pause')">⏸️</button>
        <button title="Skróć" onclick="control('${act.name}', 'shorten')">➖</button>
        <button title="Zeruj" onclick="control('${act.name}', 'zero')">↻</button>
        <button title="Usuń" onclick="control('${act.name}', 'delete')">🗑️</button>
      </td>
    `;
    tableBody.appendChild(tr);
    startCountdown(act.name, act.time_left, act.stopped);
  }
}

function formatTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

async function control(name, action) {
  await fetch("/api/timer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, action }),
  });
}

const socket = io();
socket.on("init", (activ) => renderTable(activ));
socket.on("timerUpdate", (activ) => renderTable(activ));
