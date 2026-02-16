// filepath: c:\Users\saq\webdav\tsg\stories\src\main.js
// Main entry point for TSG Stories app

// Import styles
import "./styles/base.css";
import "./styles/buttons.css";
import "./styles/text-controls.css";
import "./styles/icons.css";
import './styles/toast.css';

// main.js

// Only register SW in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/tsg/stories/sw.js')
      .then(() => console.log('Service worker registered'))
      .catch(err => console.error('SW registration failed', err));
  });
}


// Import icon system and initialize
import { initializeIcons } from './ui/icons.js';

// Initialize icons (replace img tags with inline SVG)
initializeIcons();

// Import and initialize app
import * as fabric from './fabric.index.js';

// Make globally available
window.fabric = fabric;

import './app.js';

// Log initialization
console.log('🎨 TSG Stories initializing...');