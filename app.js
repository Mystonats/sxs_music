const SECTIONS = [
  {
    id: "kingdoms",
    title: "Kingdoms of Kanstein",
    blurb: "Map themes for the realms — looping the way they do in the world.",
    open: true,
  },
  {
    id: "concert",
    title: "Luo Tianyi concert",
    blurb: "Concert-hall theme and the Luo Tianyi set: Da La Beng Ba, the Staff and Sword songs, and more.",
    open: true,
  },
  {
    id: "festival",
    title: "Music festival",
    blurb: "Soundwave hall and festival arrangements across regions.",
    open: true,
  },
  {
    id: "seasonal",
    title: "Seasonal",
    blurb: "Holiday nights, New Year skies, and the puzzle-map air.",
    open: true,
  },
  {
    id: "events",
    title: "Events",
    blurb: "Festival, collab, and limited-time themes.",
    open: false,
  },
  {
    id: "battle",
    title: "Battle",
    blurb: "Combat themes in numbered sets. These files have no song titles — only which set they belong to.",
    open: false,
  },
  {
    id: "seasons",
    title: "Season themes",
    blurb: "Extra Season 4 and Season 5 music. Untitled besides the season.",
    open: false,
  },
  {
    id: "interface",
    title: "Menus",
    blurb: "Interface themes without a listed title.",
    open: false,
  },
  {
    id: "home",
    title: "Home",
    blurb: "The homestead theme.",
    open: false,
  },
  {
    id: "fashion",
    title: "Fashion",
    blurb: "Outfit-event themes.",
    open: false,
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
const findEl = $("find");

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
const ALL = Array.isArray(window.TRACKS) ? window.TRACKS : [];

function audioUrl(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function haystack(track) {
  return `${track.name} ${track.zh} ${track.group} ${track.section}`.toLowerCase();
}

function matches(track, q) {
  if (!q) return true;
  return haystack(track).includes(q);
}

function trackButton(track, index) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "track";
  btn.dataset.index = String(index);
  btn.innerHTML = `
    <span class="cue" aria-hidden="true">▶</span>
    <span class="names">
      <p class="name">${escapeHtml(track.name)}</p>
      ${track.zh ? `<p class="zh">${escapeHtml(track.zh)}</p>` : ""}
    </span>
    <span class="badges">${(track.badges || []).map((b) =>
      `<span class="badge ${b.kind || ""}">${escapeHtml(b.text)}</span>`
    ).join("")}</span>`;
  btn.addEventListener("click", () => playAt(index, true));
  return btn;
}

function render(query) {
  const q = (query || "").trim().toLowerCase();
  catalogEl.innerHTML = "";
  playlist = [];
  let shown = 0;

  for (const section of SECTIONS) {
    const items = ALL.filter((t) => t.section === section.id && matches(t, q))
      .slice()
      .sort((a, b) => (a.group || "").localeCompare(b.group || "") || (a.sort || 0) - (b.sort || 0) || a.name.localeCompare(b.name));
    if (!items.length) continue;
    shown += items.length;

    const wrap = document.createElement("details");
    wrap.className = "section";
    wrap.id = section.id;
    wrap.open = Boolean(q) || section.open;

    const summary = document.createElement("summary");
    summary.innerHTML = `<h2>${section.title}</h2><span class="count">${items.length}</span>`;
    wrap.appendChild(summary);
    if (section.blurb) {
      const blurb = document.createElement("p");
      blurb.className = "blurb";
      blurb.textContent = section.blurb;
      wrap.appendChild(blurb);
    }

    const groups = [];
    for (const track of items) {
      const g = track.group || "";
      if (!groups.length || groups[groups.length - 1].name !== g) {
        groups.push({ name: g, tracks: [] });
      }
      groups[groups.length - 1].tracks.push(track);
    }

    for (const group of groups) {
      let host = wrap;
      if (group.name && groups.length > 1) {
        const nest = document.createElement("details");
        nest.className = "group";
        nest.open = Boolean(q) || groups.length <= 8;
        nest.innerHTML = `<summary>${escapeHtml(group.name)} <span class="count">${group.tracks.length}</span></summary>`;
        wrap.appendChild(nest);
        host = nest;
      } else if (group.name && groups.length === 1) {
        const label = document.createElement("p");
        label.className = "group-label";
        label.textContent = group.name;
        wrap.appendChild(label);
      }
      for (const track of group.tracks) {
        const index = playlist.push(track) - 1;
        host.appendChild(trackButton(track, index));
      }
    }
    catalogEl.appendChild(wrap);
  }

  if (statusEl) {
    if (!shown) {
      statusEl.hidden = false;
      statusEl.textContent = "No tracks match that search.";
      catalogEl.appendChild(statusEl);
    } else {
      statusEl.remove();
    }
  }
  paintCurrent();
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
  audio.src = audioUrl(track.path);
  playerEl.hidden = false;
  $("player-title").textContent = track.name;
  $("player-sub").textContent = track.zh || track.group || "";
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

function sectionSlice() {
  const cur = playlist[currentIndex];
  if (!cur) return playlist;
  return playlist
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t.section === cur.section);
}

function step(delta) {
  const slice = sectionSlice();
  if (!slice.length) return;
  const here = slice.findIndex((x) => x.i === currentIndex);
  const next = slice[(here + delta + slice.length) % slice.length];
  playAt(next.i, true);
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

findEl.addEventListener("input", () => render(findEl.value));

document.querySelector(".jump").addEventListener("click", (e) => {
  const a = e.target.closest("a[href^='#']");
  if (!a) return;
  const el = document.querySelector(a.getAttribute("href"));
  if (el && el.tagName === "DETAILS") el.open = true;
});

if (!ALL.length) {
  statusEl.textContent = "Playlist catalog is missing.";
} else {
  render("");
}
