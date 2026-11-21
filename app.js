
const MAX_PHOTOS = 6;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;

const photoUpload = document.getElementById('photoUpload');
const replacePhotoInput = document.getElementById('replacePhotoInput');

const thumbGrid = document.getElementById('thumbGrid');
const photoStatus = document.getElementById('photoStatus');
const stripPhotos = document.getElementById('stripPhotos');
const strip = document.getElementById('strip');

const camera = document.getElementById('camera');
const cameraWrap = document.getElementById('cameraWrap');
const takePhotoBtn = document.getElementById('takePhoto');
const startCameraBtn = document.getElementById('startCamera');
const audioPlayer = document.getElementById('audioPlayer');

let photos = [];
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
    offsetX: 0,
    offsetY: 0
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

  // Maximum distance the image can move without showing empty space.
  const limitX = Math.max(0, (drawWidth - frameWidth) / 2);
  const limitY = Math.max(0, (drawHeight - frameHeight) / 2);

  photo.offsetX = clamp(photo.offsetX || 0, -limitX, limitX);
  photo.offsetY = clamp(photo.offsetY || 0, -limitY, limitY);

  const left =
    (frameWidth - drawWidth) / 2 + photo.offsetX;

  const top =
    (frameHeight - drawHeight) / 2 + photo.offsetY;

  return {
    width: drawWidth,
    height: drawHeight,
    left,
    top
  };
}

// Update the photo displayed in the live preview.
function updatePreviewImage(slot, img, photo) {
  if (!slot || !img || !img.naturalWidth) return;

  const frameWidth = slot.clientWidth;
  const frameHeight = slot.clientHeight;

  if (!frameWidth || !frameHeight) return;

  const dimensions = getPhotoDimensions(
    photo,
    img.naturalWidth,
    img.naturalHeight,
    frameWidth,
    frameHeight
  );

  img.style.position = 'absolute';
  img.style.maxWidth = 'none';
  img.style.width = `${dimensions.width}px`;
  img.style.height = `${dimensions.height}px`;
  img.style.left = `${dimensions.left}px`;
  img.style.top = `${dimensions.top}px`;
  img.style.objectFit = 'fill';
}

// --------------------------------------------------
// ZOOM CONTROLS
// --------------------------------------------------

function changeZoom(index, amount) {
  const photo = photos[index];

  if (!photo) return;

  photo.zoom = clamp(
    photo.zoom + amount,
    MIN_ZOOM,
    MAX_ZOOM
  );

  updatePhotoSlot(index);
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

  if (!slot || !photos[index]) return;

  const img = slot.querySelector('img');

  if (img && img.complete) {
    updatePreviewImage(slot, img, photos[index]);
  }
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

    photo.offsetX += deltaX;
    photo.offsetY += deltaY;

    updatePreviewImage(slot, img, photo);
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
// RENDER PHOTOSTRIP
// --------------------------------------------------

function render() {
  const slots = [];

  for (let i = 0; i < layoutCount; i++) {
    const slot = document.createElement('div');
    slot.className = 'photo-slot';

    if (photos[i]) {
      const photo = photos[i];

      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = `Photo ${i + 1}`;
      img.draggable = false;

      img.addEventListener('load', () => {
        updatePreviewImage(slot, img, photo);
      });

      slot.appendChild(img);

      // Individual crop controls.
      slot.appendChild(createCropControls(i));

      // Drag to reposition.
      enablePhotoDragging(slot, img, photo);

    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'placeholder';
      placeholder.textContent =
        `PHOTO ${String(i + 1).padStart(2, '0')}`;

      slot.appendChild(placeholder);
    }

    // CHANGE OR ADD INDIVIDUAL PHOTO
    const changeButton = document.createElement('button');

    changeButton.type = 'button';
    changeButton.className = 'photo-change-button';
    changeButton.textContent = photos[i]
      ? 'Change photo'
      : 'Add photo';

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

  // FRAME THEME
  strip.className =
    `strip theme-${document.getElementById('themeSelect').value}`;

  // CAPTION AND DATE
  document.getElementById('stripCaption').textContent =
    document.getElementById('captionInput').value || '';

  document.getElementById('stripDate').textContent =
    document.getElementById('dateInput').value || '';

  // SELECTED SONG CREDIT
  const stripSong = document.getElementById('stripSong');

  stripSong.textContent = selectedSongName
    ? `♫ ${selectedSongName}`
    : '';

  stripSong.hidden = !selectedSongName;

  // THUMBNAIL PREVIEW
  thumbGrid.replaceChildren();

  photos.forEach((photo, index) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = `Uploaded photo ${index + 1}`;

    const number = document.createElement('span');
    number.textContent = index + 1;

    thumb.append(img, number);
    thumbGrid.appendChild(thumb);
  });

  // PHOTO STATUS
  photoStatus.textContent =
    `${photos.length} photo${photos.length === 1 ? '' : 's'} added · Add up to ${MAX_PHOTOS} photos`;

  // EXPORT INFORMATION
  document.getElementById('exportHint').textContent = photos.length
    ? 'Empty frames will appear as placeholders. PNG and JPEG save directly; PDF opens your print dialog.'
    : 'Add at least one photo to enable exporting. Empty frames will remain as placeholders.';
}

// --------------------------------------------------
// ADD MULTIPLE PHOTOS
// --------------------------------------------------

async function addFiles(files) {
  const imageFiles = [...files].filter(file =>
    file.type.startsWith('image/')
  );

  const room = MAX_PHOTOS - photos.length;

  for (const file of imageFiles.slice(0, room)) {
    try {
      const src = await readFileAsDataURL(file);
      photos.push(createPhoto(src));
    } catch (error) {
      console.error('Could not read photo:', error);
      alert(`Could not load ${file.name}.`);
    }
  }

  if (imageFiles.length > room) {
    alert(`Only ${MAX_PHOTOS} photos can be added. Extra files were skipped.`);
  }

  render();
}

photoUpload.addEventListener('change', event => {
  addFiles(event.target.files);
  photoUpload.value = '';
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

    // Replacing a photo resets its crop settings.
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

['themeSelect', 'captionInput', 'dateInput'].forEach(id => {
  document.getElementById(id).addEventListener('input', render);
});

// --------------------------------------------------
// CAMERA: OPEN AND CLOSE
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

// --------------------------------------------------
// CAMERA: CAPTURE PHOTO
// --------------------------------------------------

takePhotoBtn.addEventListener('click', () => {
  if (!camera.videoWidth || photos.length >= MAX_PHOTOS) {
    if (photos.length >= MAX_PHOTOS) {
      alert(`You can add up to ${MAX_PHOTOS} photos.`);
    }

    return;
  }

  const canvas = document.createElement('canvas');

  canvas.width = camera.videoWidth;
  canvas.height = camera.videoHeight;

  const ctx = canvas.getContext('2d');

  // Mirror webcam image.
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);

  photos.push(
    createPhoto(canvas.toDataURL('image/jpeg', 0.92))
  );

  render();
});

// --------------------------------------------------
// SELECT SONG
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

  document.getElementById('musicStatus').textContent =
    `Selected: ${file.name}`;

  render();

  document.getElementById('playMusic').disabled = false;
  document.getElementById('stopMusic').disabled = false;
});

// --------------------------------------------------
// PLAY AND PAUSE MUSIC
// --------------------------------------------------

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

// --------------------------------------------------
// STOP MUSIC
// --------------------------------------------------

document.getElementById('stopMusic').addEventListener('click', () => {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;

  document.getElementById('playMusic').textContent = '▶ Play';
});

// --------------------------------------------------
// COLOR THEMES
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

  return themes[document.getElementById('themeSelect').value];
}

// --------------------------------------------------
// DRAW PHOTO WITH THE SAME CROP AS THE PREVIEW
// --------------------------------------------------

function drawCover(ctx, img, x, y, width, height, photo) {
  const dimensions = getPhotoDimensions(
    photo,
    img.width,
    img.height,
    width,
    height
  );

  ctx.save();

  // Prevent the zoomed image from extending outside its frame.
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

// --------------------------------------------------
// CREATE EXPORT CANVAS
// --------------------------------------------------

async function createExportCanvas() {
  const colors = themeColors();

  const width = 1200;
  const pad = 64;
  const gap = 28;

  const photoW = width - pad * 2;
  const photoH = layoutCount >= 6 ? 420 : 470;

  const captionH = 95;
  const dateH = 42;
  const brandH = 45;
  const songH = selectedSongName ? 38 : 0;

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

        // Use the saved crop, zoom, and position.
        drawCover(
          ctx,
          img,
          x,
          y,
          photoW,
          photoH,
          photos[i]
        );

      } catch (error) {
        console.error('Could not load photo:', error);
      }
    } else {
      ctx.fillStyle = colors.sub;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '500 34px Georgia';

      ctx.fillText(
        `PHOTO ${String(i + 1).padStart(2, '0')}`,
        width / 2,
        y + photoH / 2
      );
    }
  }

  // CAPTION
  let y =
    pad +
    layoutCount * photoH +
    (layoutCount - 1) * gap;

  ctx.fillStyle = colors.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 48px Georgia';

  ctx.fillText(
    document.getElementById('captionInput').value || '',
    width / 2,
    y + captionH / 2,
    width - 100
  );

  y += captionH;

  // DATE
  ctx.fillStyle = colors.sub;
  ctx.font = '500 22px Arial';
  ctx.letterSpacing = '5px';

  ctx.fillText(
    document.getElementById('dateInput').value || '',
    width / 2,
    y + dateH / 2
  );

  y += dateH;

  // BRAND
  ctx.font = '500 16px Arial';
  ctx.letterSpacing = '6px';

  ctx.fillText(
    'FRAME PHOTO STUDIO',
    width / 2,
    y + brandH / 2
  );

  y += brandH;

  // SONG CREDIT
  if (selectedSongName) {
    ctx.fillStyle = colors.sub;
    ctx.font = 'italic 20px Arial';
    ctx.letterSpacing = '1px';

    ctx.fillText(
      `♫ ${selectedSongName}`,
      width / 2,
      y + songH / 2,
      width - 100
    );
  }

  return canvas;
}

// --------------------------------------------------
// EXPORT PNG OR JPEG
// --------------------------------------------------

async function exportImage(type) {
  if (!photos.length) {
    alert('Please add at least one photo before exporting.');
    return;
  }

  try {
    const canvas = await createExportCanvas();

    const mime = type === 'jpeg'
      ? 'image/jpeg'
      : 'image/png';

    const url = canvas.toDataURL(mime, 0.94);

    const link = document.createElement('a');

    link.href = url;
    link.download =
      `frame-photobooth.${type === 'jpeg' ? 'jpg' : 'png'}`;

    link.click();

  } catch (error) {
    console.error('Export error:', error);
    alert('Something went wrong while exporting your photo strip.');
  }
}

document.getElementById('savePng').addEventListener('click', () => {
  exportImage('png');
});

document.getElementById('saveJpg').addEventListener('click', () => {
  exportImage('jpeg');
});

// --------------------------------------------------
// EXPORT PDF
// --------------------------------------------------

document.getElementById('savePdf').addEventListener('click', async () => {
  if (!photos.length) {
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
          @page {
            size: 4in 6in;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
          }

          img {
            display: block;
            width: 100%;
            height: 100%;
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
// UPDATE PHOTO POSITIONS WHEN THE WINDOW RESIZES
// --------------------------------------------------

window.addEventListener('resize', () => {
  photos.forEach((photo, index) => {
    updatePhotoSlot(index);
  });
});

// --------------------------------------------------
// CLEANUP
// --------------------------------------------------

window.addEventListener('beforeunload', () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
  }
});

// --------------------------------------------------
// SET DEFAULT DATE
// --------------------------------------------------

document.getElementById('dateInput').value =
  new Date()
    .toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    .toUpperCase();

// --------------------------------------------------
// INITIAL RENDER
// --------------------------------------------------

render();
