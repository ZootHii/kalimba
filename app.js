const SOLFEGE = {
  C: "Do",
  D: "Re",
  E: "Mi",
  F: "Fa",
  G: "Sol",
  A: "La",
  B: "Si",
};

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

// Tines are arranged from left to right as on a standard 17-key C kalimba.
const TINE_ORDER = [88, 84, 81, 77, 74, 71, 67, 64, 60, 62, 65, 69, 72, 76, 79, 83, 86];

// One round-robin take per FreePats SFZ region keeps the initial download small.
// The pitch centers and fine tuning follow Kalimba-20190723.sfz.
const SAMPLE_REGIONS = [
  { min: 48, max: 56, root: 53, cents: 0, file: "F3_01.wav" },
  { min: 57, max: 61, root: 60, cents: 25, file: "1_01.wav" },
  { min: 62, max: 63, root: 63, cents: 5, file: "2_01.wav" },
  { min: 64, max: 65, root: 64, cents: -40, file: "3_01.wav" },
  { min: 66, max: 67, root: 67, cents: 7, file: "4_01.wav" },
  { min: 68, max: 70, root: 68, cents: 17, file: "5_01.wav" },
  { min: 71, max: 72, root: 72, cents: 22, file: "6_01.wav" },
  { min: 73, max: 84, root: 73, cents: -15, file: "7_01.wav" },
];

const instrument = document.querySelector("#instrument");
const keysElement = document.querySelector("#keys");
const audioStatus = document.querySelector("#audio-status");
const audioStatusText = document.querySelector(".audio-status-text");
const currentNoteElement = document.querySelector("#current-note");
const currentFrequencyElement = document.querySelector("#current-frequency");
const volumeToggle = document.querySelector("#volume-toggle");
const volumeLabel = document.querySelector("#volume-label");
const loadError = document.querySelector("#load-error");
const loadErrorMessage = document.querySelector("#load-error-message");
const retryLoad = document.querySelector("#retry-load");

const tines = new Map();
const sampleBuffers = new Map();
let audioContext;
let masterGain;
let muted = false;
let loading = false;
let previousPoint = null;
let activePointerId = null;
let lastTine = null;

function noteDetails(midi) {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  const latinRoot = name[0];
  const frequency = 440 * 2 ** ((midi - 69) / 12);

  return {
    midi,
    name,
    octave,
    solfege: SOLFEGE[latinRoot] ?? name,
    frequency,
    label: `${name}${octave}`,
  };
}

function makeTines() {
  const middleIndex = Math.floor(TINE_ORDER.length / 2);

  TINE_ORDER.forEach((midi, index) => {
    const note = noteDetails(midi);
    const distanceFromCenter = Math.abs(index - middleIndex);
    const tineHeight = 96 - distanceFromCenter * 6.7;
    const key = document.createElement("button");
    key.className = "tine";
    key.type = "button";
    key.dataset.midi = String(midi);
    key.dataset.index = String(index);
    key.style.setProperty("--tine-height", `${tineHeight}%`);
    key.setAttribute("aria-label", `${note.solfege}${note.octave}, ${note.frequency.toFixed(0)} hertz`);
    key.innerHTML = `<span class="tine-label" aria-hidden="true">${note.name}${note.octave}</span><span class="tine-metal" aria-hidden="true"></span>`;
    keysElement.append(key);
    tines.set(index, key);
  });

  const firstNote = noteDetails(TINE_ORDER[middleIndex]);
  currentNoteElement.textContent = `${firstNote.solfege}${firstNote.octave}`;
  currentFrequencyElement.textContent = `${firstNote.frequency.toFixed(0)} Hz`;
}

function setAudioStatus(state, message) {
  audioStatus.dataset.state = state;
  audioStatusText.textContent = message;
}

function setLoadError(message) {
  loadErrorMessage.textContent = message;
  loadError.hidden = false;
  setAudioStatus("error", "Ses yüklenemedi");
}

function getAudioContext() {
  if (audioContext) return audioContext;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Bu tarayıcı Web Audio seslerini desteklemiyor.");

  audioContext = new AudioContextClass();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.72;
  masterGain.connect(audioContext.destination);
  return audioContext;
}

async function loadAudio() {
  if (loading) return;
  loading = true;
  loadError.hidden = true;
  setAudioStatus("loading", "Sesler yükleniyor");

  try {
    const context = getAudioContext();
    const loaded = await Promise.all(SAMPLE_REGIONS.map(async (region) => {
      const response = await fetch(`assets/audio/${region.file}`);
      if (!response.ok) throw new Error(`Ses dosyası açılamadı: ${region.file}`);
      const data = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(data);
      return [region.file, buffer];
    }));

    for (const [file, buffer] of loaded) sampleBuffers.set(file, buffer);
    setAudioStatus("ready", "Çalmaya hazır");
  } catch (error) {
    setLoadError(error instanceof Error ? error.message : "Ses örnekleri yüklenemedi.");
  } finally {
    loading = false;
  }
}

function sampleFor(note) {
  return SAMPLE_REGIONS.find((region) => note.midi >= region.min && note.midi <= region.max)
    ?? SAMPLE_REGIONS.reduce((closest, region) => {
      const distance = note.midi < region.min ? region.min - note.midi : note.midi - region.max;
      const closestDistance = note.midi < closest.min ? closest.min - note.midi : note.midi - closest.max;
      return distance < closestDistance ? region : closest;
    });
}

function showNote(note) {
  currentNoteElement.textContent = `${note.solfege}${note.octave}`;
  currentFrequencyElement.textContent = `${note.frequency.toFixed(0)} Hz`;
}

function playTine(index) {
  const key = tines.get(index);
  if (!key) return;

  if (lastTine !== null) tines.get(lastTine)?.classList.remove("is-active");
  lastTine = index;
  key.classList.add("is-active");
  window.clearTimeout(key.activeTimer);
  key.activeTimer = window.setTimeout(() => key.classList.remove("is-active"), 160);

  const note = noteDetails(Number(key.dataset.midi));
  showNote(note);

  if (!sampleBuffers.size || !audioContext || !masterGain) return;
  if (audioContext.state === "suspended") void audioContext.resume();

  const region = sampleFor(note);
  const buffer = sampleBuffers.get(region.file);
  if (!buffer) return;

  const source = audioContext.createBufferSource();
  const noteGain = audioContext.createGain();
  const sourcePitch = region.root + region.cents / 100;
  source.buffer = buffer;
  source.playbackRate.value = 2 ** ((note.midi - sourcePitch) / 12);
  noteGain.gain.value = 0.78;
  source.connect(noteGain);
  noteGain.connect(masterGain);
  source.onended = () => {
    source.disconnect();
    noteGain.disconnect();
  };
  source.start();
}

function tineAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  const key = element?.closest(".tine");
  if (!key || !instrument.contains(key)) return null;
  return Number(key.dataset.index);
}

function triggerAtPoint(x, y) {
  const index = tineAtPoint(x, y);
  if (index === null || index === lastTine) return;
  playTine(index);
}

function traceToPoint(x, y) {
  if (!previousPoint) {
    triggerAtPoint(x, y);
    previousPoint = { x, y };
    return;
  }

  const dx = x - previousPoint.x;
  const dy = y - previousPoint.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 5));
  for (let step = 1; step <= steps; step += 1) {
    const fraction = step / steps;
    triggerAtPoint(previousPoint.x + dx * fraction, previousPoint.y + dy * fraction);
  }
  previousPoint = { x, y };
}

instrument.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || activePointerId !== null) return;
  const index = tineAtPoint(event.clientX, event.clientY);
  if (index === null) return;

  event.preventDefault();
  activePointerId = event.pointerId;
  previousPoint = null;
  lastTine = null;
  instrument.setPointerCapture(event.pointerId);
  if (audioContext?.state === "suspended") void audioContext.resume().catch(() => {});
  traceToPoint(event.clientX, event.clientY);
});

instrument.addEventListener("pointermove", (event) => {
  if (event.pointerId !== activePointerId) return;
  event.preventDefault();
  traceToPoint(event.clientX, event.clientY);
});

function endPointer(event) {
  if (event.pointerId !== activePointerId) return;
  activePointerId = null;
  previousPoint = null;
  lastTine = null;
  if (instrument.hasPointerCapture(event.pointerId)) instrument.releasePointerCapture(event.pointerId);
}

instrument.addEventListener("pointerup", endPointer);
instrument.addEventListener("pointercancel", endPointer);

keysElement.addEventListener("click", (event) => {
  // Pointer clicks have detail > 0 and already played on pointerdown.
  // detail === 0 is a keyboard or assistive-technology activation.
  if (event.detail !== 0) return;
  const key = event.target.closest(".tine");
  if (!key) return;
  if (audioContext?.state === "suspended") void audioContext.resume().catch(() => {});
  playTine(Number(key.dataset.index));
});

volumeToggle.addEventListener("click", () => {
  muted = !muted;
  volumeToggle.setAttribute("aria-pressed", String(muted));
  volumeToggle.setAttribute("aria-label", muted ? "Sesi aç" : "Sesi kapat");
  volumeLabel.textContent = muted ? "Ses kapalı" : "Ses açık";
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, audioContext.currentTime, 0.025);
  }
});

retryLoad.addEventListener("click", () => void loadAudio());

makeTines();
void loadAudio();
