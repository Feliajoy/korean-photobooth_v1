const MAX_PHOTOS = 6;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;

const photoUpload = document.getElementById('photoUpload');
const replacePhotoInput = document.getElementById('replacePhotoInput');
const clearPhotosBtn = document.getElementById('clearPhotos');

const thumbGrid = document.getElementById('thumbGrid');
const photoStatus = document.getElementById('photoStatus');
const stripPhotos = document.getElementById('stripPhotos');
const strip = document.getElementById('strip');

const themeSelect = document.getElementById('themeSelect');
const captionInput = document.getElementById('captionInput');
const dateInput = document.getElementById('dateInput');

const camera = document.getElementById('camera');
const cameraWrap = document.getElementById('cameraWrap');
const takePhotoBtn = document.getElementById('takePhoto');
const startCameraBtn = document.getElementById('startCamera');
const audioPlayer = document.getElementById('audioPlayer');

const savePngBtn = document.getElementById('savePng');
const saveJpgBtn = document.getElementById('saveJpg');
const savePdfBtn = document.getElementById('savePdf');

// Fixed-length array prevents sparse-array bugs when adding to a specific slot.
let photos = Array(MAX_PHOTOS).fill(null);
let layoutCount = 4;
let cameraStream = null;
let audioUrl = null;
let selectedSongName = '';
let replacementIndex = null;

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
    // Stored as ratios of frameWidth / frameHeight so preview and export match 1:1.
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
// ZOOM CONTROLS
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

// --------------------------------------------------
// PHOTO DRAGGING
// --------------------------------------------------

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

// --------------------------------------------------
// CROP CONTROL BUTTONS
// --------------------------------------------------

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
// RENDER METADATA (NO PHOTO FLICKER)
// --------------------------------------------------

function renderStripMeta() {
  strip.className = `strip theme-${themeSelect.value} layout-${layoutCount}`;

  document.getElementById('stripCaption').textContent =
    captionInput.value || '';

  document.getElementById('stripDate').textContent =
    dateInput.value || '';

  const stripSong = document.getElementById('stripSong');
  stripSong.textContent = selectedSongName ? `♫ ${selectedSongName}` : '';
  stripSong.hidden = !selectedSongName;
}

// --------------------------------------------------
// RENDER PHOTOSTRIP & THUMBNAILS
// --------------------------------------------------

function renderPhotos() {
  const slots = [];

  for (let i = 0; i < layoutCount; i++) {
    const slot = document.createElement('div');
    slot.className = 'photo-slot';

    if (photos[i]) {
      const photo = photos[i];
      const img = document.createElement('img');
      img.alt = `Photo ${i + 1}`;
      img.draggable = false;

      // Attach listener before setting src so cached/data URLs are handled reliably.
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
    changeButton.textContent = photos[i] ? 'Change photo' : 'Add photo';
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

  // Recalculate after DOM layout in case images loaded synchronously.
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

  // STATUS & EXPORT BUTTONS
  const count = getFilledCount();
  photoStatus.textContent =
    `${count} photo${count === 1 ? '' : 's'} added · Add up to ${MAX_PHOTOS} photos`;

  clearPhotosBtn.hidden = count === 0;

  const hasPhotos = count > 0;
  savePngBtn.disabled = !hasPhotos;
  saveJpgBtn.disabled = !hasPhotos;
  savePdfBtn.disabled = !hasPhotos;

  document.getElementById('exportHint').textContent = hasPhotos
    ? 'Empty frames will appear as placeholders. PNG and JPEG save directly; PDF opens your print dialog.'
    : 'Add at least one photo to enable exporting. Empty frames will remain as placeholders.';
}

function render() {
  renderStripMeta();
  renderPhotos();
}

// --------------------------------------------------
// ADD MULTIPLE PHOTOS & CLEAR ALL
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

// --------------------------------------------------
// REPLACE AN INDIVIDUAL PHOTO
// --------------------------------------------------

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
// CHANGE STRIP LAYOUT
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

// --------------------------------------------------
// THEME, CAPTION, AND DATE
// --------------------------------------------------

themeSelect.addEventListener('change', renderStripMeta);
captionInput.addEventListener('input', renderStripMeta);
dateInput.addEventListener('input', renderStripMeta);

// --------------------------------------------------
// CAMERA: OPEN, CLOSE, CAPTURE
// --------------------------------------------------

startCameraBtn.addEventListener('click', async () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    camera.srcObject = null;
    cameraWrap.hidden = true;
    takePhotoBtn.disabled = true;
    startCameraBtn.textContent = '◎ Open camera';
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });

    camera.srcObject = cameraStream;
    cameraWrap.hidden = false;
    takePhotoBtn.disabled = false;
    startCameraBtn.textContent = '× Close camera';
  } catch (error) {
    console.error('Camera error:', error);
    alert(
      'Camera access was not available. Please allow camera permission and use this page on localhost or HTTPS.'
    );
  }
});

takePhotoBtn.addEventListener('click', () => {
  const emptyIndex = getFirstEmptySlot();
  if (emptyIndex === -1) {
    alert(`You can add up to ${MAX_PHOTOS} photos.`);
    return;
  }
  if (!camera.videoWidth) return;

  const canvas = document.createElement('canvas');
  canvas.width = camera.videoWidth;
  canvas.height = camera.videoHeight;

  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);

  photos[emptyIndex] = createPhoto(canvas.toDataURL('image/jpeg', 0.92));
  render();
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
// COLOR THEMES & EXPORT CANVAS
// --------------------------------------------------

function themeColors() {
  const themes = {
    pink: {
      bg: '#f1d9d7',
      slot: '#e7c9c6',
      text: '#654e4b',
      sub: '#967b78'
    },
    cream: {
      bg: '#e9dfcc',
      slot: '#d8cdb9',
      text: '#5d5143',
      sub: '#897b69'
    },
    black: {
      bg: '#292727',
      slot: '#494343',
      text: '#f3e9e4',
      sub: '#cbbab3'
    },
    lavender: {
      bg: '#e4dced',
      slot: '#d0c1dc',
      text: '#665475',
      sub: '#877795'
    },
    mint: {
      bg: '#dce9df',
      slot: '#c5d9ca',
      text: '#526e5b',
      sub: '#7d9784'
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

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  ctx.drawImage(
    img,
    x + dimensions.left,
    y + dimensions.top,
    dimensions.width,
    dimensions.height
  );

  ctx.restore();
}

async function createExportCanvas() {
  const colors = themeColors();

  const width = 1200;
  const pad = 64;
  const gap = 28;

  const photoW = width - pad * 2;
  // Matches CSS aspect-ratio: 4/3 for 2/3/4-cut and 3/2 for 6-cut.
  const aspectRatio = layoutCount >= 6 ? 3 / 2 : 4 / 3;
  const photoH = Math.round(photoW / aspectRatio);

  const captionH = 100;
  const dateH = 44;
  const brandH = 44;
  const songH = selectedSongName ? 40 : 0;

  const height =
    pad +
    layoutCount * photoH +
    (layoutCount - 1) * gap +
    captionH +
    dateH +
    brandH +
    songH +
    pad;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  // DRAW PHOTO FRAMES
  for (let i = 0; i < layoutCount; i++) {
    const x = pad;
    const y = pad + i * (photoH + gap);

    ctx.fillStyle = colors.slot;
    ctx.fillRect(x, y, photoW, photoH);

    if (photos[i]) {
      try {
        const img = await loadImage(photos[i].src);
        drawCover(ctx, img, x, y, photoW, photoH, photos[i]);
      } catch (error) {
        console.error('Could not load photo:', error);
      }
    } else {
      ctx.fillStyle = colors.sub;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '4px';
      ctx.font = '500 36px Georgia, serif';
      ctx.fillText(
        `PHOTO ${String(i + 1).padStart(2, '0')}`,
        width / 2,
        y + photoH / 2
      );
    }
  }

  // CAPTION
  let y = pad + layoutCount * photoH + (layoutCount - 1) * gap;

  ctx.fillStyle = colors.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '0px';
  ctx.font = 'italic 54px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(captionInput.value || '', width / 2, y + captionH / 2, width - 100);
  y += captionH;

  // DATE
  ctx.fillStyle = colors.sub;
  ctx.font = '600 22px "DM Sans", Arial, sans-serif';
  ctx.letterSpacing = '5px';
  ctx.fillText(dateInput.value || '', width / 2, y + dateH / 2);
  y += dateH;

  // BRAND
  ctx.font = '600 17px "DM Sans", Arial, sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText('FRAME PHOTO STUDIO', width / 2, y + brandH / 2);
  y += brandH;

  // SONG CREDIT
  if (selectedSongName) {
    ctx.fillStyle = colors.sub;
    ctx.font = 'italic 22px "DM Sans", Arial, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText(`♫ ${selectedSongName}`, width / 2, y + songH / 2, width - 100);
  }

  return canvas;
}

// --------------------------------------------------
// EXPORT PNG, JPEG, PDF
// --------------------------------------------------

async function exportImage(type) {
  if (!getFilledCount()) {
    alert('Please add at least one photo before exporting.');
    return;
  }

  try {
    const canvas = await createExportCanvas();
    const mime = type === 'jpeg' ? 'image/jpeg' : 'image/png';
    const url = canvas.toDataURL(mime, 0.94);

    const link = document.createElement('a');
    link.href = url;
    link.download = `frame-photobooth.${type === 'jpeg' ? 'jpg' : 'png'}`;
    link.click();
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

  try {
    const canvas = await createExportCanvas();
    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      alert('Please allow pop-ups to export your PDF.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>FRAME Photostrip</title>
        <style>
          @page { size: 4in 6in; margin: 0; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            display: grid;
            place-items: center;
            background: #ffffff;
          }
          img {
            display: block;
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          @media print {
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
            setTimeout(() => window.print(), 250);
          };
        <\/script>
      </body>
      </html>
    `);

    printWindow.document.close();
  } catch (error) {
    console.error('PDF export error:', error);
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
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
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

render();
