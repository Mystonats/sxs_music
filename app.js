const KINGDOM_ORDER = [
  "Verdantglade",
  "Cinder Ridge",
  "Aqualis",
  "Loong Haven",
  "Aethyris",
  "Acme Nexus",
  "Whaleback",
  "Originisle",
  "Cosmic Voyage",
  "Whimsy World",
];

const EN_BY_ZH = {
  双旦奇境: "Twin Holidays",
  千霄之迹: "Traces Across the Sky",
  达拉崩吧: "Da La Beng Ba",
  杖之歌: "Song of the Staff",
  剑之歌: "Song of the Sword",
  权御天下: "The Emperor's Arrival",
  冠世一战: "Battle of a Generation",
  大君岛: "Daikun Island",
  "音乐大厅(音浪)": "Concert Hall — Soundwave",
  "音乐大厅(洛天依)": "Concert Hall — Luo Tianyi",
  音浪音乐节: "Soundwave Music Festival",
  解谜活动地图场景音乐: "Puzzle Event",
};

const SECTIONS = [
  {
    id: "kingdoms",
    title: "Kingdoms of Kanstein",
    blurb: "Map themes for the realms — looping the way they do in the world.",
  },
  {
    id: "concert",
    title: "Luo Tianyi concert",
    blurb: "Concert-hall theme and the Luo Tianyi set: Da La Beng Ba, the Staff and Sword songs, and more.",
  },
  {
    id: "festival",
    title: "Music festival",
    blurb: "Soundwave hall and festival arrangements across regions.",
  },
  {
    id: "seasonal",
    title: "Seasonal",
    blurb: "Holiday nights, New Year skies, and the puzzle-map air.",
  },
];

const $ = (id) => document.getElementById(id);

const audio = $("audio");
const playerEl = $("player");
const statusEl = $("status");
const catalogEl = $("catalog");
const seek = $("seek");
const loopToggle = $("mode-loop");
const throughToggle = $("mode-through");

const VOL_KEY = "sxs-volume";
const DEFAULT_VOL = 0.55;

function clampVol(n) {
  return Math.min(1, Math.max(0, n));
}

function readSavedVol() {
  const raw = localStorage.getItem(VOL_KEY);
  const n = raw == null ? DEFAULT_VOL : Number(raw);
  return Number.isFinite(n) ? clampVol(n) : DEFAULT_VOL;
}

function setVolume(n, persist) {
  const v = clampVol(n);
  audio.volume = v;
  audio.muted = v === 0;
  $("volume").value = String(v);
  $("btn-mute").textContent = v === 0 ? "×" : "♪";
  $("btn-mute").setAttribute("aria-label", v === 0 ? "Unmute" : "Mute");
  if (persist !== false) localStorage.setItem(VOL_KEY, String(v));
}

let lastAudible = DEFAULT_VOL;
let playlist = [];
let currentIndex = -1;

function languageFrom(text) {
  if (/日语/.test(text)) return "JP";
  if (/英语/.test(text)) return "EN";
  if (/国语/.test(text) || /国服/.test(text)) return "CN";
  if (/日服主题曲/.test(text)) return "JP";
  if (/权御天下|冠世一战/.test(text)) return "CN";
  if (/达拉崩吧/.test(text)) return "CN";
  return null;
}

function serverFrom(text) {
  if (text.includes("欧美")) return "EN";
  if (text.includes("日本")) return "JP";
  if (text.includes("港澳台")) return "TW";
  if (text.includes("大陆")) return "CN";
  return null;
}

function regionFrom(text) {
  const language = languageFrom(text);
  if (language) return language;
  if (/音浪|音乐大厅/.test(text)) return serverFrom(text);
  return null;
}

function songFrom(text) {
  const inner = text.match(/[（(]([^）)]+)[）)]/);
  if (inner && /杖之歌|剑之歌/.test(inner[1])) {
    return inner[1].split(/[·・]/)[0].trim();
  }
  for (const name of ["达拉崩吧", "权御天下", "冠世一战", "杖之歌", "剑之歌"]) {
    if (text.includes(name)) return name;
  }
  return null;
}

function hallName(text) {
  if (text.includes("音乐大厅") && text.includes("音浪")) return "音乐大厅(音浪)";
  if (text.includes("音乐大厅") && text.includes("洛天依")) return "音乐大厅(洛天依)";
  if (text.includes("音浪音乐节")) return "音浪音乐节";
  return null;
}

function classify(track) {
  if (track.bgmId === 99) return null;
  if (track.map || track.bgmId === 91) return "kingdoms";
  const blob = `${track.title} ${track.memoZh || ""}`;
  if (
    /洛天依|达拉崩吧|杖之歌|剑之歌|权御天下|冠世一战/.test(blob)
  ) {
    return "concert";
  }
  if (blob.includes("音浪")) return "festival";
  return "seasonal";
}

function present(track) {
  const blob = `${track.title} ${track.memoZh || ""}`;
  const song = songFrom(blob);
  const hall = hallName(blob);
  const zhCore = song || hall || (track.memoZh || track.title)
    .replace(/\s*-\s*公测版/g, "")
    .replace(/\s*-\s*(日本|欧美|港澳台|大陆)\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const badges = [];
  const region = regionFrom(blob);
  if (region) badges.push({ text: region, kind: "region" });
  if (/伴奏/.test(blob)) badges.push({ text: "Instrumental", kind: "" });
  if (track.map === "Whimsy World") badges.push({ text: "Unreleased", kind: "unreleased" });
  if (track.map === "Whimsy World") badges.push({ text: "Harpadia", kind: "" });

  let name;
  let zh;
  if (track.map) {
    name = track.map;
    zh = track.memoZh || "";
  } else if (track.bgmId === 91) {
    name = "Daikun Island";
    zh = "大君岛";
  } else {
    name = EN_BY_ZH[zhCore] || EN_BY_ZH[song] || track.title;
    zh = song || hall || zhCore;
  }

  return {
    ...track,
    section: classify(track),
    name,
    zh,
    badges,
    src: "audio/" + encodeURIComponent(track.file) + ".ogg",
  };
}

function sortKingdoms(tracks) {
  const rank = new Map(KINGDOM_ORDER.map((m, i) => [m, i]));
  return tracks.slice().sort((a, b) => {
    const ra = a.map ? rank.get(a.map) : KINGDOM_ORDER.length;
    const rb = b.map ? rank.get(b.map) : KINGDOM_ORDER.length;
    const da = ra === undefined ? KINGDOM_ORDER.length : ra;
    const db = rb === undefined ? KINGDOM_ORDER.length : rb;
    return da - db || a.bgmId - b.bgmId;
  });
}

function render(tracks) {
  catalogEl.innerHTML = "";
  playlist = [];

  for (const section of SECTIONS) {
    let items = tracks.filter((t) => t.section === section.id);
    if (section.id === "kingdoms") items = sortKingdoms(items);
    if (!items.length) continue;

    const wrap = document.createElement("section");
    wrap.className = "section";
    wrap.id = section.id;
    wrap.innerHTML = `<h2>${section.title}</h2><p class="blurb">${section.blurb}</p>`;

    for (const track of items) {
      const index = playlist.push(track) - 1;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "track";
      btn.dataset.index = String(index);
      btn.innerHTML = `
        <span class="cue" aria-hidden="true">▶</span>
        <span class="names">
          <p class="name">${escapeHtml(track.name)}</p>
          ${track.zh && track.zh !== track.name ? `<p class="zh">${escapeHtml(track.zh)}</p>` : ""}
        </span>
        <span class="badges">${track.badges.map((b) =>
          `<span class="badge ${b.kind}">${escapeHtml(b.text)}</span>`
        ).join("")}</span>`;
      btn.addEventListener("click", () => playAt(index, true));
      wrap.appendChild(btn);
    }
    catalogEl.appendChild(wrap);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(t) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function applyLoopMode() {
  const through = throughToggle.checked;
  if (through) loopToggle.checked = false;
  audio.loop = loopToggle.checked && !through;
}

function playAt(index, autoplay) {
  const track = playlist[index];
  if (!track) return;
  currentIndex = index;
  audio.src = track.src;
  playerEl.hidden = false;
  $("player-title").textContent = track.name;
  $("player-sub").textContent = track.zh && track.zh !== track.name ? track.zh : "";
  $("player-kicker").textContent = SECTIONS.find((s) => s.id === track.section)?.title || "Now playing";
  paintCurrent();
  applyLoopMode();
  if (autoplay) {
    audio.play().catch(() => {});
  }
}

function paintCurrent() {
  for (const el of document.querySelectorAll(".track")) {
    const i = Number(el.dataset.index);
    el.classList.toggle("is-current", i === currentIndex);
    el.classList.toggle("is-playing", i === currentIndex && !audio.paused);
    el.querySelector(".cue").textContent = i === currentIndex && !audio.paused ? "❚❚" : "▶";
  }
  $("btn-play").textContent = audio.paused ? "▶" : "❚❚";
  $("btn-play").setAttribute("aria-label", audio.paused ? "Play" : "Pause");
}

function step(delta) {
  if (!playlist.length) return;
  const next = (currentIndex + delta + playlist.length) % playlist.length;
  playAt(next, true);
}

loopToggle.addEventListener("change", () => {
  if (loopToggle.checked) throughToggle.checked = false;
  applyLoopMode();
});
throughToggle.addEventListener("change", applyLoopMode);

$("btn-play").addEventListener("click", () => {
  if (currentIndex < 0) {
    playAt(0, true);
    return;
  }
  if (audio.paused) audio.play();
  else audio.pause();
});
$("btn-prev").addEventListener("click", () => step(-1));
$("btn-next").addEventListener("click", () => step(1));

audio.addEventListener("play", paintCurrent);
audio.addEventListener("pause", paintCurrent);
audio.addEventListener("loadedmetadata", () => {
  seek.max = String(audio.duration || 0);
  $("time-end").textContent = fmt(audio.duration);
});
audio.addEventListener("timeupdate", () => {
  if (!seek.matches(":active")) seek.value = String(audio.currentTime || 0);
  $("time-now").textContent = fmt(audio.currentTime);
});
audio.addEventListener("ended", () => {
  if (throughToggle.checked) step(1);
});
seek.addEventListener("input", () => {
  audio.currentTime = Number(seek.value);
});

const volumeEl = $("volume");
setVolume(readSavedVol());
lastAudible = audio.volume || DEFAULT_VOL;

volumeEl.addEventListener("input", () => {
  const v = Number(volumeEl.value);
  if (v > 0) lastAudible = v;
  setVolume(v);
});

$("btn-mute").addEventListener("click", () => {
  if (audio.volume === 0) setVolume(lastAudible || DEFAULT_VOL);
  else {
    lastAudible = audio.volume || lastAudible;
    setVolume(0);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, button")) return;
  if (e.code === "Space") {
    e.preventDefault();
    $("btn-play").click();
  } else if (e.code === "ArrowRight") step(1);
  else if (e.code === "ArrowLeft") step(-1);
  else if (e.code === "ArrowUp") {
    e.preventDefault();
    setVolume(audio.volume + 0.05);
    if (audio.volume > 0) lastAudible = audio.volume;
  } else if (e.code === "ArrowDown") {
    e.preventDefault();
    setVolume(audio.volume - 0.05);
    if (audio.volume > 0) lastAudible = audio.volume;
  }
});

const rows = Array.isArray(window.TRACKS) ? window.TRACKS : [];
if (!rows.length) {
  statusEl.textContent = "Playlist catalog is missing.";
} else {
  render(rows.map(present).filter((t) => t.section));
  statusEl.remove();
}
