// filepath: c:\Users\saq\webdav\tsg\stories\config.js
// Centralized application configuration

/* ================= CANVAS SIZES ================= */
export const CANVAS_SIZES = {
    '1080x1920': { width: 1080, height: 1920, label: '9:16' },
    '1440x1920': { width: 1440, height: 1920, label: '3:4' }
};

// Canvas background color
export const CANVAS_BG_COLOR = '#aaaaaa';

/* ================= INTERACTION CONFIG ================= */
export const INTERACTION_CONFIG = {
    HOLD_DELAY: 1000,
    HOLD_MOVE_THRESHOLD: 10,
    WHEEL_ZOOM_STEP: 0.05,
    KEY_NUDGE: 1,
    KEY_NUDGE_FAST: 5,
    SNAP_THRESHOLD: 8,
    AUTOSAVE_DELAY: 2000,
    DOUBLE_TAP_DELAY: 300,
    GRID_SIZE: 10
};

/* ================= EXPORT CONFIG ================= */
export const EXPORT_CONFIG = {
    QUALITY: 1.0,
    FORMAT: 'image/png',
    FILENAME_PREFIX: 'tsg-stories-',
    STORAGE_QUALITY: 0.95,
    STORAGE_FORMAT: 'image/jpeg'
};

/* ================= TEXT DEFAULTS ================= */
export const TEXT_DEFAULTS = {
    FONT_FAMILY: 'Merriweather',
    FONT_SIZE: 40,
    FONT_WEIGHT: 400,
    COLOR: '#ffffff',
    BACKGROUND: '#1a1a1a',
    BACKGROUND_OPACITY: 0.6,
    PADDING: 45,
    RADIUS: 24,
    LINE_HEIGHT: 1.5,
    TEXT_ALIGN: 'left',
    CHAR_SPACING: 0,
    X: 240,
    Y: 400,
    WIDTH: 600,
    HEIGHT: 200
};

/* ================= PRESET VALUES ================= */
export const PRESET_VALUES = {
    FONT_SIZES: [32, 40, 50, 58, 66, 72],
    FONT_WEIGHTS: [300, 400, 500, 600, 700, 800, 900],
    LINE_HEIGHTS: [1.1, 1.2, 1.3, 1.4, 1.5, 1.6],
    CHAR_SPACINGS: [-50, -25, 0, 25, 50, 75, 100, 150, 200],
    PADDINGS: [30, 35, 45, 50, 55],
    OFFSETS: [-10, -5, 0, 5, 10, 15, 20],
    BG_OPACITIES: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
};

/* ================= COLORS ================= */
export const COLORS = {
    TEXT: ['#ffffff', '#1a1a1a', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de'],
    BACKGROUND: ['#1a1a1a', '#ffffff', '#1a1a1a', '#333333', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de']
};

/* ================= FABRIC CONFIG ================= */
export const FABRIC_CONFIG = {
    ENABLE_RETINA_SCALING: false,
    DEVICE_PIXEL_RATIO: 1,
    PRESERVE_OBJECT_STACKING: true,
    SELECTION: true,
    DEFAULT_CURSOR: 'default',
    HOVER_CURSOR: 'pointer'
};

/* ================= TEXTBOX DEFAULTS ================= */
export const TEXTBOX_DEFAULTS = {
    EDITABLE: true,
    CURSOR_WIDTH: 2,
    SELECTABLE: true,
    HAS_CONTROLS: true,
    HAS_BORDERS: true,
    LOCK_UNI_SCALING: false,
    LOCK_SCALING_FLIP: false,
    OBJECT_CACHING: false,
    CORNER_STYLE: 'rect',
    CORNER_COLOR: '#fff',
    BORDER_COLOR: '#fff',
    CORNER_SIZE: 12,
    TRANSPARENT_CORNERS: false,
    PADDING: 0,
    SPLIT_BY_GRAPHEME: false,
    BREAK_WORDS: false,
    ORIGIN_X: 'left',
    ORIGIN_Y: 'top'
};