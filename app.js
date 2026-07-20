// Requires config.js loaded first (SUPABASE_URL, SUPABASE_ANON_KEY)
// and the supabase-js CDN script loaded before this file.

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PHOTO_BUCKET = "bin-photos";

function publicPhotoUrl(path) {
  const { data } = sb.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadPhoto(binId, file) {
  const resized = await resizeImage(file, 1000, 0.75);
  const ext = "jpg";
  const path = `${binId}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, resized, {
    contentType: "image/jpeg",
    upsert: false
  });
  if (error) throw error;
  const { error: insErr } = await sb.from("photos").insert({ bin_id: binId, storage_path: path });
  if (insErr) throw insErr;
}

// Resize/compress an image file client-side before upload, so bins with
// several photos don't balloon storage or load time.
function resizeImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Edit this list any time to add/remove/reorder rooms in the dropdown.
// Every page pulls from this one place, so a change here shows up everywhere.
const ROOMS = [
  "Master Bedroom",
  "Secondary Bedroom",
  "Master Bath",
  "Secondary Bath",
  "Kitchen",
  "Living Room",
  "Office",
  "Garage",
  "Shed"
];

// Builds a <select> of ROOMS plus an "Other" option. If currentValue isn't
// in the list, it's treated as a custom value: "Other" is selected and the
// paired text input (otherInputId) is shown pre-filled with currentValue.
function populateRoomSelect(selectEl, otherInputEl, currentValue) {
  selectEl.innerHTML = "";
  ROOMS.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    selectEl.appendChild(opt);
  });
  const otherOpt = document.createElement("option");
  otherOpt.value = "__other__";
  otherOpt.textContent = "Other (type below)";
  selectEl.appendChild(otherOpt);

  if (currentValue && !ROOMS.includes(currentValue)) {
    selectEl.value = "__other__";
    otherInputEl.style.display = "block";
    otherInputEl.value = currentValue;
  } else {
    selectEl.value = currentValue || ROOMS[0];
    otherInputEl.style.display = "none";
  }

  selectEl.onchange = () => {
    otherInputEl.style.display = selectEl.value === "__other__" ? "block" : "none";
    if (selectEl.value === "__other__") otherInputEl.focus();
  };
}

function resolveRoomValue(selectEl, otherInputEl) {
  return selectEl.value === "__other__" ? otherInputEl.value.trim() : selectEl.value;
}

function binUrl(binId) {
  const base = window.location.origin + window.location.pathname.replace(/index\.html$|bin\.html$/, "");
  return `${base}bin.html?id=${binId}`;
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function showStatus(el, message, isErr) {
  el.textContent = message;
  el.className = "status " + (isErr ? "err" : "ok");
  if (!isErr) setTimeout(() => { el.textContent = ""; }, 2500);
}

// Call at the top of any protected page. Bounces to login.html if there's
// no active session. Returns once auth is confirmed so the rest of the
// page's data-loading code can run.
async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const here = window.location.pathname.split("/").pop() + window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent(here)}`;
    return false;
  }
  return true;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = "login.html";
}
