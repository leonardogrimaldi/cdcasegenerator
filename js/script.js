/* =============================================================
   CD Case Generator — Script
   ============================================================= */

'use strict';

/* ── State ─────────────────────────────────────────────────── */
const state = {
  albumTitle:        '',
  artistName:        '',
  albumYear:         '',
  albumGenre:        '',
  bgColor:           '#1a1a2e',
  txtColor:          '#ffffff',
  coverImageDataUrl: null,
  backNotes:         '',
  tracks: [
    { title: '', duration: '' },
  ],
};

/* ── Utility helpers ────────────────────────────────────────── */

/**
 * Escape a string for safe insertion as HTML text content.
 */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parse a "m:ss" or bare-seconds string into total seconds.
 */
function parseDuration(str) {
  if (!str) return 0;
  const s = str.trim();
  if (s.includes(':')) {
    const [m, sec] = s.split(':');
    return (parseInt(m, 10) || 0) * 60 + (parseInt(sec, 10) || 0);
  }
  return parseInt(s, 10) || 0;
}

/**
 * Format total seconds as "m:ss".
 */
function fmtSeconds(total) {
  if (!total) return '';
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Normalise a user-typed duration string to "m:ss".
 * Accepts "3:45", "345" (seconds), "3:5" → "3:05", etc.
 */
function normaliseDuration(raw) {
  const s = (raw || '').replace(/[^0-9:]/g, '').trim();
  if (!s) return '';
  if (s.includes(':')) {
    const [m, sec] = s.split(':');
    const minutes = parseInt(m, 10) || 0;
    const seconds = Math.min(parseInt(sec, 10) || 0, 59);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  const total = parseInt(s, 10) || 0;
  return fmtSeconds(total);
}

/**
 * Sum durations of all tracks and return formatted string.
 */
function totalDuration(tracks) {
  const secs = tracks.reduce((sum, t) => sum + parseDuration(t.duration), 0);
  return fmtSeconds(secs);
}

/* ── Track list rendering ───────────────────────────────────── */

function renderTrackList() {
  const container = document.getElementById('trackListContainer');
  container.innerHTML = '';

  state.tracks.forEach((track, i) => {
    const row = document.createElement('div');
    row.className = 'track-row';

    const numSpan = document.createElement('span');
    numSpan.className = 'track-num';
    numSpan.textContent = `${i + 1}.`;

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'track-title-input';
    titleInput.placeholder = 'Track title';
    titleInput.value = track.title;
    titleInput.maxLength = 100;
    titleInput.dataset.index = i;
    titleInput.dataset.field = 'title';
    titleInput.addEventListener('input', onTrackInput);

    const durInput = document.createElement('input');
    durInput.type = 'text';
    durInput.className = 'track-dur-input';
    durInput.placeholder = '0:00';
    durInput.value = track.duration;
    durInput.maxLength = 6;
    durInput.dataset.index = i;
    durInput.dataset.field = 'duration';
    durInput.addEventListener('input', onTrackInput);
    durInput.addEventListener('blur', onDurationBlur);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'track-del-btn';
    delBtn.title = 'Remove track';
    delBtn.textContent = '×';
    delBtn.dataset.index = i;
    delBtn.addEventListener('click', () => removeTrack(i));

    row.appendChild(numSpan);
    row.appendChild(titleInput);
    row.appendChild(durInput);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

function onTrackInput(e) {
  const idx   = parseInt(e.target.dataset.index, 10);
  const field = e.target.dataset.field;
  state.tracks[idx][field] = e.target.value;
  updatePreview();
}

function onDurationBlur(e) {
  const idx = parseInt(e.target.dataset.index, 10);
  const normalised = normaliseDuration(e.target.value);
  state.tracks[idx].duration = normalised;
  e.target.value = normalised;
  updatePreview();
}

function addTrack() {
  state.tracks.push({ title: '', duration: '' });
  renderTrackList();
  updatePreview();

  // Focus the new track's title input
  const inputs = document.querySelectorAll('.track-title-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function removeTrack(index) {
  if (state.tracks.length <= 1) {
    // Keep at least one row, just clear it
    state.tracks[0] = { title: '', duration: '' };
  } else {
    state.tracks.splice(index, 1);
  }
  renderTrackList();
  updatePreview();
}

/* ── HTML builders ──────────────────────────────────────────── */

/**
 * Build the inner HTML for a front cover panel.
 */
function buildFrontHTML(title, artist, bgColor, txtColor, imageDataUrl) {
  const hasImage = !!imageDataUrl;
  const bgStyle  = hasImage
    ? `background-image:url('${imageDataUrl}');background-size:cover;background-position:center;`
    : `background-color:${bgColor};`;

  return `
    <div class="case-cover" style="${bgStyle}color:${esc(txtColor)};">
      ${hasImage ? '<div class="case-cover-overlay"></div>' : ''}
      <div class="case-cover-text">
        <div class="cover-title">${esc(title)  || 'Album Title'}</div>
        <div class="cover-artist">${esc(artist) || 'Artist Name'}</div>
      </div>
    </div>`;
}

/**
 * Build the inner HTML for a spine panel.
 * (Used for preview only – the print spine is driven by text nodes in the HTML.)
 */
function buildSpineHTML(title, artist, bgColor, txtColor) {
  return `
    <div style="width:100%;height:100%;background-color:${esc(bgColor)};color:${esc(txtColor)};">
      <div class="spine-content">
        <span class="spine-title-text">${esc(title)}</span>
        <span class="spine-artist-text">${esc(artist)}</span>
      </div>
    </div>`;
}

/**
 * Build the inner HTML for a back cover panel.
 */
function buildBackHTML(title, artist, year, genre, notes, tracks, bgColor, txtColor) {
  const trackItems = tracks
    .filter(t => t.title || t.duration)
    .map((t, i) => `
      <div class="back-track-item">
        <span class="back-track-name">${i + 1}. ${esc(t.title)}</span>
        <span class="back-track-dur">${esc(t.duration)}</span>
      </div>`)
    .join('');

  const total = totalDuration(tracks);

  const metaParts = [
    year  ? esc(year)  : '',
    genre ? esc(genre) : '',
    total ? `Total: ${total}` : '',
  ].filter(Boolean);

  return `
    <div class="back-inner" style="background-color:${esc(bgColor)};color:${esc(txtColor)};">
      <div class="back-header-block">
        <div class="back-album-title">${esc(title)  || 'Album Title'}</div>
        <div class="back-artist-name">${esc(artist) || 'Artist Name'}</div>
      </div>
      <div class="back-track-list">${trackItems}</div>
      <div class="back-footer">
        ${notes ? `<div class="back-footer-notes">${esc(notes)}</div>` : ''}
        <div class="back-footer-meta">
          ${metaParts.map(p => `<span>${p}</span>`).join('')}
        </div>
      </div>
    </div>`;
}

/* ── Preview & print template update ───────────────────────── */

function updatePreview() {
  const { albumTitle, artistName, albumYear, albumGenre,
          bgColor, txtColor, coverImageDataUrl, backNotes, tracks } = state;

  document.getElementById('prevFront').innerHTML =
    buildFrontHTML(albumTitle, artistName, bgColor, txtColor, coverImageDataUrl);

  document.getElementById('prevSpine').innerHTML =
    buildSpineHTML(albumTitle, artistName, bgColor, txtColor);

  document.getElementById('prevBack').innerHTML =
    buildBackHTML(albumTitle, artistName, albumYear, albumGenre, backNotes, tracks, bgColor, txtColor);

  // Sync print template at the same time
  syncPrintTemplate();
}

function syncPrintTemplate() {
  const { albumTitle, artistName, albumYear, albumGenre,
          bgColor, txtColor, coverImageDataUrl, backNotes, tracks } = state;

  document.getElementById('printFront').innerHTML =
    buildFrontHTML(albumTitle, artistName, bgColor, txtColor, coverImageDataUrl);

  document.getElementById('printBack').innerHTML =
    buildBackHTML(albumTitle, artistName, albumYear, albumGenre, backNotes, tracks, bgColor, txtColor);

  // Spine text nodes
  document.getElementById('printSpineTitle').textContent  = albumTitle;
  document.getElementById('printSpineArtist').textContent = artistName;
  const spine = document.getElementById('printSpine');
  spine.style.backgroundColor = bgColor;
  spine.style.color           = txtColor;
}

/* ── Event binding ──────────────────────────────────────────── */

function bindFormEvents() {
  // Simple text / number / textarea fields
  const textFields = ['albumTitle', 'artistName', 'albumYear', 'albumGenre', 'backNotes'];
  textFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      state[id] = el.value;
      updatePreview();
    });
  });

  // Background colour
  const bgInput = document.getElementById('bgColor');
  bgInput.addEventListener('input', () => {
    state.bgColor = bgInput.value;
    document.getElementById('bgColorHex').textContent = bgInput.value;
    updatePreview();
  });

  // Text colour
  const txtInput = document.getElementById('txtColor');
  txtInput.addEventListener('input', () => {
    state.txtColor = txtInput.value;
    document.getElementById('txtColorHex').textContent = txtInput.value;
    updatePreview();
  });

  // Cover image
  document.getElementById('coverImage').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) {
      state.coverImageDataUrl = null;
      document.getElementById('coverImageName').textContent = '';
      updatePreview();
      return;
    }
    document.getElementById('coverImageName').textContent = file.name;
    const reader = new FileReader();
    reader.addEventListener('load', ev => {
      state.coverImageDataUrl = ev.target.result;
      updatePreview();
    });
    reader.readAsDataURL(file);
  });

  // Add track button
  document.getElementById('addTrackBtn').addEventListener('click', addTrack);

  // Print button (preview is already in sync via updatePreview → syncPrintTemplate)
  document.getElementById('printBtn').addEventListener('click', () => {
    window.print();
  });
}

/* ── Initialisation ─────────────────────────────────────────── */

function init() {
  renderTrackList();
  bindFormEvents();
  updatePreview();
}

document.addEventListener('DOMContentLoaded', init);
