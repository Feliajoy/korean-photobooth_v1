FRAME — Korean-inspired Photobooth

A browser-based photobooth made with HTML, CSS, and vanilla JavaScript. No framework or build step is required.

Project structure

korean-photobooth/
├── index.html
├── styles.css
├── app.js
└── README.md


Run it

Extract the ZIP file.

Open the folder in Visual Studio Code.

Start index.html with the Live Server extension, or run a local server:

Python: python -m http.server 8000

Then visit http://localhost:8000

Allow camera permission when prompted.

Camera access generally requires localhost or HTTPS. Opening the HTML file directly may allow photo uploads, but webcam access may be blocked by the browser.

Features

Upload up to six images, replace or remove individual slots, or clear all photos.

Capture photos from a webcam or phone camera with a 3-second countdown (no flash) and front/back camera flip.

Drag to reposition and zoom/reset each photo with 1:1 preview-to-export cropping.

Choose print-ready 2-cut, 3-cut, 4-cut (2 × 6 in), or 6-cut (4 × 6 in / 4R grid) layouts at 600 DPI.

Apply seven Korean photobooth photo filters (Original, Soft Peach, B&W Classic, Warm Film, Cool Seoul, Vintage 90s, and Milk Cream).

Choose five frame themes (Seoul Blush, Milk Tea, Midnight, Lavender Dream, and Soft Mint).

Add a custom caption and date.

Load and play an audio file from your device.

Export as a Single Copy or a 4R Print Sheet (two 2 × 6 in strips side-by-side with a center cut line) in PNG or JPEG.

Print or export PDF through the browser print dialog. Choose Save as PDF as the printer/destination.

Notes

Music is for preview during the session; it is not embedded into exported image or PDF files.

Photos and audio are handled locally in the browser. This project does not upload them to a server.

For smartphone use, host the folder over HTTPS (such as Netlify Drop, GitHub Pages, or Cloudflare Pages) and open it in a full browser like Chrome, Safari, or Brave rather than an in-app browser.

The PDF action opens the browser's print dialog because this version intentionally uses no third-party PDF library.

For a polished PDF or print, choose portrait orientation (4 × 6 in for 4R sheets/6-cut or 2 × 6 in for single strips), disable margins and browser headers/footers if offered, and select Save as PDF.

© 2026 DataMewPH. All rights reserved.
