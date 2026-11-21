# FRAME — Korean-inspired Photobooth

A browser-based photobooth made with HTML, CSS, and vanilla JavaScript. No framework or build step is required.

## Project structure

```text
korean-photobooth/
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Run it

1. Extract the ZIP file.
2. Open the folder in Visual Studio Code.
3. Start `index.html` with the **Live Server** extension, or run a local server:
   - Python: `python -m http.server 8000`
   - Then visit `http://localhost:8000`
4. Allow camera permission when prompted.

Camera access generally requires `localhost` or HTTPS. Opening the HTML file directly may allow photo uploads, but webcam access may be blocked by the browser.

## Features

- Upload up to six images.
- Capture photos from a webcam.
- Choose 2-cut, 3-cut, 4-cut, or 6-cut layouts.
- Choose five frame themes.
- Add a caption and date.
- Load and play an audio file from your device.
- Export the photostrip as PNG or JPEG.
- Export PDF through the browser print dialog. Choose **Save as PDF** as the printer/destination.

## Notes

- Music is for preview during the session; it is not embedded into exported image or PDF files.
- Photos and audio are handled locally in the browser. This project does not upload them to a server.
- The PDF action opens the browser's print dialog because this version intentionally uses no third-party PDF library.
- For a polished PDF, choose portrait orientation, disable browser headers/footers if offered, and select **Save as PDF**.
