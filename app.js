
const MAX_PHOTOS = 6;

const photoUpload = document.getElementById('photoUpload');
const replacePhotoInput = document.getElementById('replacePhotoInput');

let replacementIndex = null;

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

// RENDER PHOTOSTRIP
function render() {
  const slots = [];

  for (let i = 0; i < layoutCount; i++) {
    const slot = document.createElement('div');
    slot.className = 'photo-slot';

    if (photos[i]) {
      const img = document.createElement('img');
      img.src = photos[i].src;
      img.alt = `Photo ${i + 1}`;
      slot.appendChild(img);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'placeholder';
      placeholder.textContent =
        `PHOTO ${String(i + 1).padStart(2, '0')}`;
      slot.appendChild(placeholder);
    }

    // CHANGE PHOTO BUTTON
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

  strip.className =
    `strip theme-${document.getElementById('themeSelect').value}`;

  document.getElementById('stripCaption').textContent =
    document.getElementById('captionInput').value || '';

  document.getElementById('stripDate').textContent =
    document.getElementById('dateInput').value || '';

  // DISPLAY SELECTED SONG
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

  photoStatus.textContent =
    `${photos.length} photo${photos.length === 1 ? '' : 's'} added · Add up to ${MAX_PHOTOS} photos`;

  document.getElementById('exportHint').textContent = photos.length
    ? 'Empty frames will appear as placeholders. PNG and JPEG save directly; PDF opens your print dialog.'
    : 'Add at least one photo to enable exporting. Empty frames will remain as placeholders.';
}

// ADD MULTIPLE PHOTOS
async function addFiles(files) {
  const imageFiles = [...files].filter(file =>
    file.type.startsWith('image/')
  );

  const room = MAX_PHOTOS - photos.length;

  for (const file of imageFiles.slice(0, room)) {
    const src = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;

      reader.readAsDataURL(file);
    });

    photos.push({ src });
  }

  if (imageFiles.length > room) {
    alert(`Only ${MAX_PHOTOS} photos can be added. Extra files were skipped.`);
  }

  render();
}

photoUpload.addEventListener('change', e => {
  addFiles(e.target.files);
});

// REPLACE AN INDIVIDUAL PHOTO
replacePhotoInput.addEventListener('change', async e => {
  const file = e.target.files?.[0];

  if (!file || replacementIndex === null) return;

  if (!file.type.startsWith('image/')) {
    alert('Please choose a valid image file.');
    return;
  }

  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });

  photos[replacementIndex] = { src };

  replacementIndex = null;
  render();
});

// CHANGE STRIP LAYOUT
document.querySelectorAll('[data-layout]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-layout]').forEach(b =>
      b.classList.remove('active')
    );

    button.classList.add('active');

    layoutCount = Number(button.dataset.layout);
    render();
  });
});

// THEME, CAPTION, AND DATE
['themeSelect', 'captionInput', 'dateInput'].forEach(id => {
  document.getElementById(id).addEventListener('input', render);
});

// OPEN AND CLOSE CAMERA
startCameraBtn.addEventListener('click', async () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());

    cameraStream = null;
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
    alert(
      'Camera access was not available. Please allow camera permission and use this page on localhost or HTTPS.'
    );
  }
});

// CAPTURE PHOTO
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

  // Mirror webcam image
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);

  photos.push({
    src: canvas.toDataURL('image/jpeg', 0.92)
  });

  render();
});

// SELECT SONG
document.getElementById('songUpload').addEventListener('change', e => {
  const file = e.target.files[0];

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

// PLAY AND PAUSE MUSIC
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
  } catch {
    alert('The selected audio file could not be played.');
  }
});

audioPlayer.addEventListener('ended', () => {
  document.getElementById('playMusic').textContent = '▶ Play';
});

// STOP MUSIC
document.getElementById('stopMusic').addEventListener('click', () => {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;

  document.getElementById('playMusic').textContent = '▶ Play';
});

// FIT COMPLETE PHOTO INSIDE FRAME
function drawContain(ctx, img, x, y, w, h) {
  const scale = Math.min(
    w / img.width,
    h / img.height
  );

  const drawW = img.width * scale;
  const drawH = img.height * scale;

  const drawX = x + (w - drawW) / 2;
  const drawY = y + (h - drawH) / 2;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

// COLOR THEMES
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

// CREATE EXPORT CANVAS
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

        drawContain(ctx, img, x, y, photoW, photoH);

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

// EXPORT PNG OR JPEG
async function exportImage(type) {
  if (!photos.length) {
    alert('Please add at least one photo before exporting.');
    return;
  }

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
}

document.getElementById('savePng').addEventListener('click', () => {
  exportImage('png');
});

document.getElementById('saveJpg').addEventListener('click', () => {
  exportImage('jpeg');
});

// EXPORT PDF
document.getElementById('savePdf').addEventListener('click', async () => {
  if (!photos.length) {
    alert('Please add at least one photo before exporting.');
    return;
  }

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
});

// CLEANUP
window.addEventListener('beforeunload', () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
  }
});

// SET DEFAULT DATE
document.getElementById('dateInput').value =
  new Date()
    .toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    .toUpperCase();

// INITIAL RENDER
render();
