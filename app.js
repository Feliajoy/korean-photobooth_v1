const MAX_PHOTOS = 6;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;
const COUNTDOWN_SECONDS = 3;

const FONT_SANS = '"Inter", Arial, sans-serif';
const FONT_SERIF = '"Playfair Display", Georgia, serif';

// Exact 600 DPI print layouts:
// 2, 3, 4-Cut = 2 x 6 inches (1200 x 3600 px)
// 6-Cut       = 4 x 6 inches / 4R (2400 x 3600 px)
const LAYOUT_CONFIG = {
  2: {
    cols: 1,
    rows: 2,
    width: 1200,
    height: 3600,
    padX: 60,
    padTop: 60,
    gapX: 0,
    gapY: 28,
    photoW: 1080,
    photoH: 1588,
    footerH: 336,
    label: '2 × 6 IN · 600 DPI'
  },
  3: {
    cols: 1,
    rows: 3,
    width: 1200,
    height: 3600,
    padX: 60,
    padTop: 60,
    gapX: 0,
    gapY: 30,
    photoW: 1080,
    photoH: 1048,
    footerH: 336,
    label: '2 × 6 IN · 600 DPI'
  },
  4: {
    cols: 1,
    rows: 4,
    width: 1200,
    height: 3600,
    padX: 60,
    padTop: 60,
    gapX: 0,
    gapY: 28,
    photoW: 1080,
    photoH: 780,
    footerH: 336,
    label: '2 × 6 IN · 600 DPI'
  },
  6: {
    cols: 2,
    rows: 3,
    width: 2400,
    height: 3600,
    padX: 80,
    padTop: 80,
    gapX: 40,
    gapY: 38,
    photoW: 1100,
    photoH: 1028,
    footerH: 360,
    label: '4 × 6 IN (4R) · 600 DPI'
  }
};

// Korean photobooth-inspired filters (single source of truth for CSS + Canvas export)
const FILTERS = {
  none: {
    name: 'Original',
    brightness: 1,
    contrast: 1,
    saturate: 1,
    sepia: 0,
    grayscale: 0,
    tint: 'transparent',
    swatch: 'linear-gradient(135deg, #e7c9c6, #dce9df)'
  },
  peach: {
    name: 'Soft Peach',
    brightness: 1.06,
    contrast: 0.95,
    saturate: 1.12,
    sepia: 0.08,
    grayscale: 0,
    tint: 'rgba(255, 196, 182, 0.13)',
    swatch: 'linear-gradient(135deg, #ffd8cc, #f29f8f)'
  },
  bw: {
    name: 'B&W Classic',
    brightness: 1.03,
    contrast: 1.16,
    saturate: 1,
    sepia: 0,
    grayscale: 1,
    tint: 'transparent',
    swatch: 'linear-gradient(135deg, #222222, #e0e0e0)'
  },
  film: {
    name: 'Warm Film',
    brightness: 1.02,
    contrast: 1.07,
    saturate: 1.08,
    sepia: 0.24,
    grayscale: 0,
    tint: 'rgba(255, 206, 138, 0.11)',
    swatch: 'linear-gradient(135deg, #e9be80, #9d683f)'
  },
  seoul: {
    name: 'Cool Seoul',
    brightness: 1.06,
    contrast: 1.04,
    saturate: 0.92,
    sepia: 0,
    grayscale: 0,
    tint: 'rgba(175, 212, 255, 0.14)',
    swatch: 'linear-gradient(135deg, #cfe4ff, #87a7d4)'
  },
  vintage: {
    name: 'Vintage 90s',
    brightness: 1.04,
    contrast: 0.92,
    saturate: 0.78,
    sepia: 0.22,
    grayscale: 0,
    tint: 'rgba(218, 192, 165, 0.14)',
    swatch: 'linear-gradient(135deg, #dac4a8, #8e7966)'
  },
  cream: {
    name: 'Milk Cream',
    brightness: 1.1,
    contrast: 0.88,
    saturate: 0.92,
    sepia: 0.1,
    grayscale: 0,
    tint: 'rgba(255, 245, 228, 0.16)',
    swatch: 'linear-gradient(135deg, #fff6e6, #e5d2b8)'
  }
};

const photoUpload = document.getElementById('photoUpload');
const replacePhotoInput = document.getElementById('replacePhotoInput');
const clearPhotosBtn = document.getElementById('clearPhotos');

const thumbGrid = document.getElementById('thumbGrid');
const photoStatus = document.getElementById('photoStatus');
const stripPhotos = document.getElementById('stripPhotos');
const strip = document.getElementById('strip');
const previewSizeTag = document.getElementById('previewSizeTag');

const filterGrid = document.getElementById('filterGrid');
const themeSelect = document.getElementById('themeSelect');
const captionInput = document.getElementById('captionInput');
const dateInput = document.getElementById('dateInput');

const camera = document.getElementById('camera');
const cameraWrap = document.getElementById('cameraWrap');
const cameraStage = document.getElementById('cameraStage');
const cameraCountdown = document.getElementById('cameraCountdown');
const cameraHint = document.getElementById('cameraHint');
const takePhotoBtn = document.getElementById('takePhoto');
const startCameraBtn = document.getElementById('startCamera');
const flipCameraBtn = document.getElementById('flipCamera');
const audioPlayer = document.getElementById('audioPlayer');

const exportSizeSpec = document.getElementById('exportSizeSpec');
const mode4rSub = document.getElementById('mode4rSub');
const savePngBtn = document.getElementById('savePng');
const saveJpgBtn = document.getElementById('saveJpg');
const savePdfBtn = document.getElementById('savePdf');

let photos = Array(MAX_PHOTOS).fill(null);
let layoutCount = 4;
let selectedFilter = 'none';
let exportMode = 'single'; // 'single' | '4r'
let cameraStream = null;
let cameraFacingMode = 'user'; // 'user' | 'environment'
let countdownTimer = null;
let isCountingDown = false;
let audioUrl = null;
let selectedSongName = '';
let replacementIndex = null;
let nativeCanvasFilterSupported = null;

// --------------------------------------------------
// GENERAL HELPERS
// --------------------------------------------------

function formatSongTitle(fileName) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function createPhoto(src) {
  return {
    src,
    zoom: 1,
    offsetX: 0,
    offsetY: 0
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getFilledCount() {
  return photos.filter(Boolean).length;
}

function getFirstEmptySlot() {
  return photos.findIndex(item => item === null);
}

function isTwoUpPrint() {
  return exportMode === '4r' && layoutCount !== 6;
}

// --------------------------------------------------
// PHOTO FILTERS (CSS + CANVAS + FALLBACK)
// --------------------------------------------------

function getFilterCss(filterKey) {
  const f = FILTERS[filterKey] || FILTERS.none;
  if (filterKey === 'none') return 'none';

  const parts = [];
  if (f.grayscale) parts.push(`grayscale(${f.grayscale})`);
  if (f.sepia) parts.push(`sepia(${f.sepia})`);
  if (f.brightness !== 1) parts.push(`brightness(${f.brightness})`);
  if (f.contrast !== 1) parts.push(`contrast(${f.contrast})`);
  if (f.saturate !== 1) parts.push(`saturate(${f.saturate})`);
  return parts.length ? parts.join(' ') : 'none';
}

function supportsCanvasFilter() {
  if (nativeCanvasFilterSupported !== null) {
    return nativeCanvasFilterSupported;
  }
  try {
    const test = document.createElement('canvas');
    test.width = 2;
    test.height = 2;
    const tctx = test.getContext('2d');
    if (!('filter' in tctx)) {
      nativeCanvasFilterSupported = false;
      return false;
    }
    tctx.filter = 'grayscale(1)';
    tctx.fillStyle = '#ff0000';
    tctx.fillRect(0, 0, 2, 2);
    const [r, g, b] = tctx.getImageData(0, 0, 1, 1).data;
    nativeCanvasFilterSupported = r === g && g === b;
  } catch {
    nativeCanvasFilterSupported = false;
  }
  return nativeCanvasFilterSupported;
}

function applyPixelFilter(ctx, x, y, width, height, filterKey) {
  const f = FILTERS[filterKey];
  if (!f || filterKey === 'none') return;

  const imgData = ctx.getImageData(x, y, width, height);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    if (f.grayscale > 0) {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = r + (gray - r) * f.grayscale;
      g = g + (gray - g) * f.grayscale;
      b = b + (gray - b) * f.grayscale;
    }

    if (f.sepia > 0) {
      const sr = r * 0.393 + g * 0.769 + b * 0.189;
      const sg = r * 0.349 + g * 0.686 + b * 0.168;
      const sb = r * 0.272 + g * 0.534 + b * 0.131;
      r = r + (sr - r) * f.sepia;
      g = g + (sg - g) * f.sepia;
      b = b + (sb - b) * f.sepia;
    }

    if (f.brightness !== 1) {
      r *= f.brightness;
      g *= f.brightness;
      b *= f.brightness;
    }

    if (f.contrast !== 1) {
      r = (r - 128) * f.contrast + 128;
      g = (g - 128) * f.contrast + 128;
      b = (b - 128) * f.contrast + 128;
    }

    if (f.saturate !== 1) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum + (r - lum) * f.saturate;
      g = lum + (g - lum) * f.saturate;
      b = lum + (b - lum) * f.saturate;
    }

    d[i] = clamp(Math.round(r), 0, 255);
    d[i + 1] = clamp(Math.round(g), 0, 255);
    d[i + 2] = clamp(Math.round(b), 0, 255);
  }

  ctx.putImageData(imgData, x, y);
}

function initFilterButtons() {
  filterGrid.replaceChildren();

  Object.entries(FILTERS).forEach(([key, def]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `filter-chip${key === selectedFilter ? ' active' : ''}`;
    btn.dataset.filter = key;

    const swatch = document.createElement('span');
    swatch.className = 'filter-swatch';
    swatch.style.background = def.swatch;

    const label = document.createElement('span');
    label.textContent = def.name;

    btn.append(swatch, label);

    btn.addEventListener('click', () => {
      selectedFilter = key;
      filterGrid.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.filter === key);
      });
      applyLiveFilter();
    });

    filterGrid.appendChild(btn);
  });
}

function applyLiveFilter() {
  const f = FILTERS[selectedFilter] || FILTERS.none;
  const cssFilter = getFilterCss(selectedFilter);

  strip.style.setProperty('--photo-filter', cssFilter);
  strip.style.setProperty('--photo-tint', f.tint);

  cameraStage.style.setProperty('--photo-filter', cssFilter);
  cameraStage.style.setProperty('--photo-tint', f.tint);
}

// --------------------------------------------------
// PHOTO CROP CALCULATIONS
// --------------------------------------------------

function getPhotoDimensions(photo, imageWidth, imageHeight, frameWidth, frameHeight) {
  const baseScale = Math.max(
    frameWidth / imageWidth,
    frameHeight / imageHeight
  );

  const scale = baseScale * (photo.zoom || 1);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;

  const limitX = Math.max(0, (drawWidth - frameWidth) / 2);
  const limitY = Math.max(0, (drawHeight - frameHeight) / 2);

  const clampedX = clamp((photo.offsetX || 0) * frameWidth, -limitX, limitX);
  const clampedY = clamp((photo.offsetY || 0) * frameHeight, -limitY, limitY);

  return {
    width: drawWidth,
    height: drawHeight,
    left: (frameWidth - drawWidth) / 2 + clampedX,
    top: (frameHeight - drawHeight) / 2 + clampedY,
    clampedRatioX: frameWidth ? clampedX / frameWidth : 0,
    clampedRatioY: frameHeight ? clampedY / frameHeight : 0
  };
}

function updatePreviewImage(slot, img, photo) {
  if (!slot || !img || !img.naturalWidth) return null;

  const frameWidth = slot.clientWidth;
  const frameHeight = slot.clientHeight;
  if (!frameWidth || !frameHeight) return null;

  const dimensions = getPhotoDimensions(
    photo,
    img.naturalWidth,
    img.naturalHeight,
    frameWidth,
    frameHeight
  );

  img.style.width = `${dimensions.width}px`;
  img.style.height = `${dimensions.height}px`;
  img.style.left = `${dimensions.left}px`;
  img.style.top = `${dimensions.top}px`;

  return dimensions;
}

// --------------------------------------------------
// ZOOM & DRAG CONTROLS
// --------------------------------------------------

function changeZoom(index, amount) {
  const photo = photos[index];
  if (!photo) return;

  photo.zoom = clamp(
    Number((photo.zoom + amount).toFixed(2)),
    MIN_ZOOM,
    MAX_ZOOM
  );

  const dims = updatePhotoSlot(index);
  if (dims) {
    photo.offsetX = dims.clampedRatioX;
    photo.offsetY = dims.clampedRatioY;
  }
}

function resetCrop(index) {
  const photo = photos[index];
  if (!photo) return;

  photo.zoom = 1;
  photo.offsetX = 0;
  photo.offsetY = 0;

  updatePhotoSlot(index);
}

function updatePhotoSlot(index) {
  const slot = stripPhotos.children[index];
  if (!slot || !photos[index]) return null;

  const img = slot.querySelector('img');
  if (img && img.complete && img.naturalWidth) {
    return updatePreviewImage(slot, img, photos[index]);
  }
  return null;
}

function enablePhotoDragging(slot, img, photo) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  slot.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    if (!img.naturalWidth) return;

    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;

    slot.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  slot.addEventListener('pointermove', event => {
    if (!dragging) return;

    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;

    lastX = event.clientX;
    lastY = event.clientY;

    const frameWidth = slot.clientWidth || 1;
    const frameHeight = slot.clientHeight || 1;

    photo.offsetX += deltaX / frameWidth;
    photo.offsetY += deltaY / frameHeight;

    const dims = updatePreviewImage(slot, img, photo);
    if (dims) {
      photo.offsetX = dims.clampedRatioX;
      photo.offsetY = dims.clampedRatioY;
    }

    event.preventDefault();
  });

  function stopDragging() {
    dragging = false;
  }

  slot.addEventListener('pointerup', stopDragging);
  slot.addEventListener('pointercancel', stopDragging);
  slot.addEventListener('lostpointercapture', stopDragging);
}

function createCropControls(index) {
  const controls = document.createElement('div');
  controls.className = 'crop-toolbar';

  const zoomOut = document.createElement('button');
  zoomOut.type = 'button';
  zoomOut.className = 'crop-control-button';
  zoomOut.textContent = '−';
  zoomOut.setAttribute('aria-label', 'Zoom out');
  zoomOut.addEventListener('click', event => {
    event.stopPropagation();
    changeZoom(index, -ZOOM_STEP);
  });

  const zoomIn = document.createElement('button');
  zoomIn.type = 'button';
  zoomIn.className = 'crop-control-button';
  zoomIn.textContent = '+';
  zoomIn.setAttribute('aria-label', 'Zoom in');
  zoomIn.addEventListener('click', event => {
    event.stopPropagation();
    changeZoom(index, ZOOM_STEP);
  });

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'crop-control-button crop-reset-button';
  reset.textContent = 'Reset';
  reset.addEventListener('click', event => {
    event.stopPropagation();
    resetCrop(index);
  });

  controls.append(zoomOut, zoomIn, reset);
  return controls;
}

// --------------------------------------------------
// RENDER METADATA & PHOTOSTRIP
// --------------------------------------------------

function renderExportInfo() {
  const cfg = LAYOUT_CONFIG[layoutCount];
  previewSizeTag.textContent = cfg.label;

  if (layoutCount === 6) {
    mode4rSub.textContent = '6-Cut already fills a full 4×6 sheet';
    exportSizeSpec.textContent = 'Output: 4 × 6 in / 4R (2400 × 3600 px · 600 DPI)';
  } else if (exportMode === '4r') {
    mode4rSub.textContent = '2 strips side-by-side + cut line';
    exportSizeSpec.textContent = 'Output: 4 × 6 in / 4R Sheet — 2× strips (2400 × 3600 px · 600 DPI)';
  } else {
    mode4rSub.textContent = '2 strips side-by-side + cut line';
    exportSizeSpec.textContent = 'Output: 2 × 6 in Single Strip (1200 × 3600 px · 600 DPI)';
  }
}

function renderStripMeta() {
  strip.className = `strip theme-${themeSelect.value} layout-${layoutCount}`;

  document.getElementById('stripCaption').textContent =
    captionInput.value || '';

  document.getElementById('stripDate').textContent =
    dateInput.value || '';

  const stripSong = document.getElementById('stripSong');
  stripSong.textContent = selectedSongName ? `♫ ${selectedSongName}` : '';
  stripSong.hidden = !selectedSongName;

  applyLiveFilter();
  renderExportInfo();
}

function renderPhotos() {
  const slots = [];

  for (let i = 0; i < layoutCount; i++) {
    const slot = document.createElement('div');
    slot.className = photos[i] ? 'photo-slot has-photo' : 'photo-slot';

    if (photos[i]) {
      const photo = photos[i];
      const img = document.createElement('img');
      img.alt = `Photo ${i + 1}`;
      img.draggable = false;

      img.addEventListener('load', () => {
        updatePreviewImage(slot, img, photo);
      });
      img.src = photo.src;

      slot.appendChild(img);
      slot.appendChild(createCropControls(i));
      enablePhotoDragging(slot, img, photo);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'placeholder';
      placeholder.textContent = `PHOTO ${String(i + 1).padStart(2, '0')}`;
      slot.appendChild(placeholder);
    }

    const changeButton = document.createElement('button');
    changeButton.type = 'button';
    changeButton.className = 'photo-change-button';
    changeButton.textContent = photos[i] ? 'Change' : 'Add photo';
    changeButton.setAttribute(
      'aria-label',
      `${photos[i] ? 'Change' : 'Add'} photo ${i + 1}`
    );

    changeButton.addEventListener('click', () => {
      replacementIndex = i;
      replacePhotoInput.value = '';
      replacePhotoInput.click();
    });

    slot.appendChild(changeButton);
    slots.push(slot);
  }

  stripPhotos.replaceChildren(...slots);

  requestAnimationFrame(() => {
    for (let i = 0; i < layoutCount; i++) {
      updatePhotoSlot(i);
    }
  });

  // THUMBNAIL PREVIEW
  thumbGrid.replaceChildren();

  photos.forEach((photo, index) => {
    if (!photo) return;

    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = `Uploaded photo ${index + 1}`;

    const number = document.createElement('span');
    number.className = 'thumb-number';
    number.textContent = index + 1;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'thumb-remove';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', `Remove photo ${index + 1}`);
    removeBtn.addEventListener('click', () => {
      photos[index] = null;
      render();
    });

    thumb.append(img, number, removeBtn);
    thumbGrid.appendChild(thumb);
  });

  const count = getFilledCount();
  photoStatus.textContent =
    `${count} photo${count === 1 ? '' : 's'} added · Add up to ${MAX_PHOTOS} photos`;

  clearPhotosBtn.hidden = count === 0;

  const hasPhotos = count > 0;
  savePngBtn.disabled = !hasPhotos;
  saveJpgBtn.disabled = !hasPhotos;
  savePdfBtn.disabled = !hasPhotos;

  document.getElementById('exportHint').textContent = hasPhotos
    ? 'Tip: Select "4R Print Sheet" to print two 2×6 strips side-by-side on standard 4R photo paper with zero waste.'
    : 'Add at least one photo to enable exporting. Empty frames will remain as placeholders.';
}

function render() {
  renderStripMeta();
  renderPhotos();
}

// --------------------------------------------------
// ADD, REPLACE & CLEAR PHOTOS
// --------------------------------------------------

async function addFiles(files) {
  const imageFiles = [...files].filter(file =>
    file.type.startsWith('image/')
  );

  let skipped = 0;

  for (const file of imageFiles) {
    const emptyIndex = getFirstEmptySlot();
    if (emptyIndex === -1) {
      skipped++;
      continue;
    }

    try {
      const src = await readFileAsDataURL(file);
      photos[emptyIndex] = createPhoto(src);
    } catch (error) {
      console.error('Could not read photo:', error);
      alert(`Could not load ${file.name}.`);
    }
  }

  if (skipped > 0) {
    alert(`Only ${MAX_PHOTOS} photos can be added. ${skipped} extra file${skipped === 1 ? ' was' : 's were'} skipped.`);
  }

  render();
}

photoUpload.addEventListener('change', event => {
  addFiles(event.target.files);
  photoUpload.value = '';
});

clearPhotosBtn.addEventListener('click', () => {
  photos = Array(MAX_PHOTOS).fill(null);
  render();
});

replacePhotoInput.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file || replacementIndex === null) return;

  if (!file.type.startsWith('image/')) {
    alert('Please choose a valid image file.');
    replacementIndex = null;
    return;
  }

  try {
    const src = await readFileAsDataURL(file);
    photos[replacementIndex] = createPhoto(src);
    replacementIndex = null;
    render();
  } catch (error) {
    console.error('Could not replace photo:', error);
    alert('The selected photo could not be loaded.');
    replacementIndex = null;
  }

  replacePhotoInput.value = '';
});

// --------------------------------------------------
// LAYOUT, EXPORT MODE, THEME, CAPTION & DATE
// --------------------------------------------------

document.querySelectorAll('[data-layout]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-layout]').forEach(item =>
      item.classList.remove('active')
    );

    button.classList.add('active');
    layoutCount = Number(button.dataset.layout);
    render();
  });
});

document.querySelectorAll('[data-export-mode]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-export-mode]').forEach(item =>
      item.classList.remove('active')
    );

    button.classList.add('active');
    exportMode = button.dataset.exportMode;
    renderExportInfo();
  });
});

themeSelect.addEventListener('change', renderStripMeta);
captionInput.addEventListener('input', renderStripMeta);
dateInput.addEventListener('input', renderStripMeta);

// --------------------------------------------------
// CAMERA: OPEN, CLOSE, FLIP, 3-SECOND COUNTDOWN
// --------------------------------------------------

function cancelCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  isCountingDown = false;
  cameraCountdown.hidden = true;
  cameraCountdown.textContent = '';
  takePhotoBtn.textContent = 'Capture';
  takePhotoBtn.disabled = !cameraStream;
  flipCameraBtn.disabled = false;
  cameraHint.textContent = 'Position yourself and press Capture (3s timer)';
}

function stopCameraStream() {
  cancelCountdown();
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  camera.srcObject = null;
}

async function openCamera(facingMode) {
  stopCameraStream();

  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facingMode } },
    audio: false
  });

  cameraFacingMode = facingMode;
  camera.srcObject = cameraStream;
  camera.classList.toggle('mirrored', cameraFacingMode === 'user');
  cameraWrap.hidden = false;
  takePhotoBtn.disabled = false;
  startCameraBtn.textContent = '× Close camera';
}

function captureCameraFrame() {
  if (!cameraStream || !camera.videoWidth) return;

  const emptyIndex = getFirstEmptySlot();
  if (emptyIndex === -1) {
    alert(`You can add up to ${MAX_PHOTOS} photos.`);
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = camera.videoWidth;
  canvas.height = camera.videoHeight;

  const ctx = canvas.getContext('2d');

  // Mirror only when using the front-facing camera
  if (cameraFacingMode === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);

  photos[emptyIndex] = createPhoto(canvas.toDataURL('image/jpeg', 0.92));
  render();
}

function startCaptureCountdown() {
  let remaining = COUNTDOWN_SECONDS;
  isCountingDown = true;
  takePhotoBtn.disabled = true;
  flipCameraBtn.disabled = true;
  cameraCountdown.hidden = false;

  function renderTick(num) {
    cameraCountdown.innerHTML = `<span>${num}</span>`;
    takePhotoBtn.textContent = `Capturing in ${num}…`;
    cameraHint.textContent = `Hold your pose… ${num}`;
  }

  renderTick(remaining);

  countdownTimer = setInterval(() => {
    remaining -= 1;

    if (remaining > 0) {
      renderTick(remaining);
    } else {
      cancelCountdown();
      captureCameraFrame();
    }
  }, 1000);
}

startCameraBtn.addEventListener('click', async () => {
  if (cameraStream) {
    stopCameraStream();
    cameraWrap.hidden = true;
    takePhotoBtn.disabled = true;
    startCameraBtn.textContent = '◎ Open camera';
    return;
  }

  try {
    await openCamera(cameraFacingMode);
  } catch (error) {
    console.error('Camera error:', error);
    alert(
      'Camera access was not available. Please allow camera permission and use this page on localhost or HTTPS.'
    );
  }
});

flipCameraBtn.addEventListener('click', async () => {
  if (!cameraStream || isCountingDown) return;
  const nextFacing = cameraFacingMode === 'user' ? 'environment' : 'user';

  try {
    await openCamera(nextFacing);
  } catch (error) {
    console.error('Could not switch camera:', error);
    try {
      await openCamera(cameraFacingMode);
    } catch {
      alert('Unable to switch camera on this device.');
    }
  }
});

takePhotoBtn.addEventListener('click', () => {
  if (isCountingDown) return;

  if (getFirstEmptySlot() === -1) {
    alert(`You can add up to ${MAX_PHOTOS} photos.`);
    return;
  }

  if (!camera.videoWidth) return;

  startCaptureCountdown();
});

// --------------------------------------------------
// MUSIC CONTROLS
// --------------------------------------------------

document.getElementById('songUpload').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;

  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
  }

  audioUrl = URL.createObjectURL(file);
  audioPlayer.src = audioUrl;
  selectedSongName = formatSongTitle(file.name);

  document.getElementById('musicStatus').textContent = `Selected: ${file.name}`;
  document.getElementById('playMusic').disabled = false;
  document.getElementById('stopMusic').disabled = false;
  document.getElementById('playMusic').textContent = '▶ Play';

  renderStripMeta();
});

document.getElementById('playMusic').addEventListener('click', async () => {
  const playButton = document.getElementById('playMusic');

  if (!audioPlayer.paused) {
    audioPlayer.pause();
    playButton.textContent = '▶ Play';
    return;
  }

  try {
    await audioPlayer.play();
    playButton.textContent = 'Ⅱ Pause';
  } catch (error) {
    alert('The selected audio file could not be played.');
  }
});

audioPlayer.addEventListener('ended', () => {
  document.getElementById('playMusic').textContent = '▶ Play';
});

document.getElementById('stopMusic').addEventListener('click', () => {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  document.getElementById('playMusic').textContent = '▶ Play';
});

// --------------------------------------------------
// COLOR THEMES & PRINT-READY EXPORT CANVAS
// --------------------------------------------------

function themeColors() {
  const themes = {
    pink: {
      bg: '#f1d9d7',
      slot: '#e7c9c6',
      text: '#654e4b',
      sub: '#967b78',
      cut: 'rgba(101, 78, 75, 0.28)'
    },
    cream: {
      bg: '#e9dfcc',
      slot: '#d8cdb9',
      text: '#5d5143',
      sub: '#897b69',
      cut: 'rgba(93, 81, 67, 0.28)'
    },
    black: {
      bg: '#292727',
      slot: '#494343',
      text: '#f3e9e4',
      sub: '#cbbab3',
      cut: 'rgba(243, 233, 228, 0.32)'
    },
    lavender: {
      bg: '#e4dced',
      slot: '#d0c1dc',
      text: '#665475',
      sub: '#877795',
      cut: 'rgba(102, 84, 117, 0.28)'
    },
    mint: {
      bg: '#dce9df',
      slot: '#c5d9ca',
      text: '#526e5b',
      sub: '#7d9784',
      cut: 'rgba(82, 110, 91, 0.28)'
    }
  };

  return themes[themeSelect.value] || themes.pink;
}

function drawCover(ctx, img, x, y, width, height, photo) {
  const dimensions = getPhotoDimensions(
    photo,
    img.width,
    img.height,
    width,
    height
  );

  const filterDef = FILTERS[selectedFilter] || FILTERS.none;
  const useNativeFilter = selectedFilter !== 'none' && supportsCanvasFilter();

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  if (useNativeFilter) {
    ctx.filter = getFilterCss(selectedFilter);
  }

  ctx.drawImage(
    img,
    x + dimensions.left,
    y + dimensions.top,
    dimensions.width,
    dimensions.height
  );

  ctx.filter = 'none';

  if (selectedFilter !== 'none' && !useNativeFilter) {
    applyPixelFilter(ctx, x, y, width, height, selectedFilter);
  }

  if (filterDef.tint && filterDef.tint !== 'transparent') {
    ctx.fillStyle = filterDef.tint;
    ctx.fillRect(x, y, width, height);
  }

  ctx.restore();
}

async function createStripCanvas() {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const colors = themeColors();
  const cfg = LAYOUT_CONFIG[layoutCount];

  const canvas = document.createElement('canvas');
  canvas.width = cfg.width;
  canvas.height = cfg.height;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, cfg.width, cfg.height);

  // DRAW PHOTO FRAMES
  for (let i = 0; i < layoutCount; i++) {
    const col = i % cfg.cols;
    const row = Math.floor(i / cfg.cols);

    const x = cfg.padX + col * (cfg.photoW + cfg.gapX);
    const y = cfg.padTop + row * (cfg.photoH + cfg.gapY);

    ctx.fillStyle = colors.slot;
    ctx.fillRect(x, y, cfg.photoW, cfg.photoH);

    if (photos[i]) {
      try {
        const img = await loadImage(photos[i].src);
        drawCover(ctx, img, x, y, cfg.photoW, cfg.photoH, photos[i]);
      } catch (error) {
        console.error('Could not load photo:', error);
      }
    } else {
      ctx.fillStyle = colors.sub;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '4px';
      ctx.font = `500 32px ${FONT_SERIF}`;
      ctx.fillText(
        `PHOTO ${String(i + 1).padStart(2, '0')}`,
        x + cfg.photoW / 2,
        y + cfg.photoH / 2
      );
    }
  }

  // DRAW FOOTER
  const footerTop = cfg.height - cfg.footerH;
  const isWide = layoutCount === 6;
  const maxTextW = cfg.width - cfg.padX * 2;

  const lines = [];
  const captionVal = captionInput.value.trim();
  const dateVal = dateInput.value.trim();

  if (captionVal) {
    lines.push({
      text: captionVal,
      color: colors.text,
      font: `italic 500 ${isWide ? 60 : 46}px ${FONT_SERIF}`,
      spacing: '0px',
      height: isWide ? 82 : 66
    });
  }

  if (dateVal) {
    lines.push({
      text: dateVal,
      color: colors.sub,
      font: `600 ${isWide ? 26 : 21}px ${FONT_SANS}`,
      spacing: '6px',
      height: isWide ? 44 : 38
    });
  }

  lines.push({
    text: 'FRAME PHOTO STUDIO',
    color: colors.sub,
    font: `600 ${isWide ? 21 : 17}px ${FONT_SANS}`,
    spacing: '7px',
    height: isWide ? 40 : 34
  });

  if (selectedSongName) {
    lines.push({
      text: `♫ ${selectedSongName}`,
      color: colors.sub,
      font: `italic 500 ${isWide ? 24 : 20}px ${FONT_SANS}`,
      spacing: '1px',
      height: isWide ? 44 : 38
    });
  }

  const totalBlockH = lines.reduce((sum, item) => sum + item.height, 0);
  let cursorY = footerTop + (cfg.footerH - totalBlockH) / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const line of lines) {
    ctx.fillStyle = line.color;
    ctx.font = line.font;
    ctx.letterSpacing = line.spacing;
    ctx.fillText(line.text, cfg.width / 2, cursorY + line.height / 2, maxTextW);
    cursorY += line.height;
  }

  return canvas;
}

async function createFinalExportCanvas() {
  const stripCanvas = await createStripCanvas();

  if (!isTwoUpPrint()) {
    return stripCanvas;
  }

  const colors = themeColors();
  const sheet = document.createElement('canvas');
  sheet.width = 2400;  // 4 in @ 600 DPI
  sheet.height = 3600; // 6 in @ 600 DPI

  const ctx = sheet.getContext('2d');
  ctx.drawImage(stripCanvas, 0, 0);
  ctx.drawImage(stripCanvas, 1200, 0);

  // Subtle dashed cut guide down the center
  ctx.save();
  ctx.strokeStyle = colors.cut;
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 16]);
  ctx.beginPath();
  ctx.moveTo(1200, 0);
  ctx.lineTo(1200, 3600);
  ctx.stroke();
  ctx.restore();

  return sheet;
}

// --------------------------------------------------
// EXPORT PNG, JPEG, PDF (MOBILE-SAFE)
// --------------------------------------------------

async function exportImage(type) {
  if (!getFilledCount()) {
    alert('Please add at least one photo before exporting.');
    return;
  }

  try {
    const canvas = await createFinalExportCanvas();
    const mime = type === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = type === 'jpeg' ? 'jpg' : 'png';

    const suffix = isTwoUpPrint()
      ? `${layoutCount}cut-4R-sheet`
      : `${layoutCount}cut-${layoutCount === 6 ? '4R' : '2x6'}`;

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, mime, 0.95)
    );

    if (!blob) {
      throw new Error('Failed to create image blob.');
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `frame-${suffix}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (error) {
    console.error('Export error:', error);
    alert('Something went wrong while exporting your photo strip.');
  }
}

savePngBtn.addEventListener('click', () => exportImage('png'));
saveJpgBtn.addEventListener('click', () => exportImage('jpeg'));

savePdfBtn.addEventListener('click', async () => {
  if (!getFilledCount()) {
    alert('Please add at least one photo before exporting.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print or save as PDF.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Preparing Print Sheet…</title>
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          background: #fbf6f4;
          color: #352927;
        }
      </style>
    </head>
    <body>Preparing your 600 DPI print sheet…</body>
    </html>
  `);

  try {
    const canvas = await createFinalExportCanvas();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.96);

    const pageW = isTwoUpPrint() || layoutCount === 6 ? 4 : 2;
    const pageH = 6;

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FRAME Photostrip (${pageW}x${pageH} in)</title>
        <style>
          @page {
            size: ${pageW}in ${pageH}in;
            margin: 0;
          }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            min-height: 100%;
            display: grid;
            place-items: center;
            background: #ffffff;
          }
          img {
            display: block;
            width: ${pageW}in;
            height: ${pageH}in;
            max-width: 100vw;
            max-height: 100vh;
            object-fit: contain;
          }
          @media print {
            html, body {
              width: ${pageW}in;
              height: ${pageH}in;
            }
            img {
              width: 100%;
              height: 100%;
              max-width: none;
              max-height: none;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" alt="Photostrip">
        <script>
          window.onload = () => {
            setTimeout(() => window.print(), 300);
          };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } catch (error) {
    console.error('PDF export error:', error);
    printWindow.close();
    alert('Something went wrong while preparing your PDF.');
  }
});

// --------------------------------------------------
// RESIZE, CLEANUP & INIT
// --------------------------------------------------

window.addEventListener('resize', () => {
  for (let i = 0; i < layoutCount; i++) {
    updatePhotoSlot(i);
  }
});

window.addEventListener('beforeunload', () => {
  stopCameraStream();
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
  }
});

dateInput.value = new Date()
  .toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  .toUpperCase();

initFilterButtons();
render();
