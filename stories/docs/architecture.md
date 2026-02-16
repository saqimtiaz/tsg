
## Next Steps (Optional)

**Error handling** with custom error classes
```javascript
// errorHandler.js
export class AppError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.details = details;
    }
}

export const ErrorCodes = {
    DB_INIT_FAILED: 'DB_INIT_FAILED',
    IMAGE_LOAD_FAILED: 'IMAGE_LOAD_FAILED',
    EXPORT_FAILED: 'EXPORT_FAILED',
    FONT_LOAD_FAILED: 'FONT_LOAD_FAILED'
};

export function handleError(error, context = '') {
    console.error(`[${context}]`, error);
    
    // Could show user-friendly toast notifications
    if (error instanceof AppError) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

// Usage:
try {
    await initDB();
} catch (err) {
    throw new AppError(
        'Failed to initialize database',
        ErrorCodes.DB_INIT_FAILED,
        { originalError: err }
    );
}
```

3. **Type safety** with JSDoc comments

# Refactoring Summary

## New Files Created

### 1. `config.js`
Centralized configuration module containing:
- **CANVAS_SIZES**: Canvas dimension presets (9:16 and 3:4)
- **INTERACTION_CONFIG**: User interaction settings (delays, thresholds, zoom, autosave)
- **EXPORT_CONFIG**: Export and storage settings (quality, format, filename)
- **TEXT_DEFAULTS**: Default values for new textboxes
- **PRESET_VALUES**: UI preset options (font sizes, weights, line heights, etc.)
- **COLORS**: Color palettes for text and backgrounds
- **FABRIC_CONFIG**: Fabric.js canvas configuration
- **TEXTBOX_DEFAULTS**: Fabric.js textbox default properties

### 2. `utils.js`
Utility functions module containing:
- **ID Generation**: `generateId()` - UUID or fallback random ID
- **Debounce**: `debounce()` - Function debouncing utility
- **Math Utilities**: `clamp()`, `snapToGrid()`
- **Color Utilities**: `rgbToHex()` - RGB to hex conversion
- **Date/Time Utilities**: `formatTimestamp()` - Formatted timestamps
- **Image Utilities**: `loadImageFromFile()`, `pickImageFile()` - Image loading helpers
- **Font Utilities**: `loadFont()`, `loadFonts()` - Font loading helpers
- **DOM Utilities**: `createElement()` - Declarative element creation
- **Object Utilities**: `deepClone()`, `isEqual()` - Object manipulation

### 3. `fabricManager.js` ✨ NEW
Fabric.js canvas management class:
- **Initialization**: `initialize(width, height)` - Set up Fabric canvas with config
- **Zoom Control**: `setZoom(scale)` - Update zoom with error handling
- **Object Management**: `add()`, `remove()`, `getObjects()`, `clear()`
- **Selection**: `getActiveTextbox()`, `clearSelection()`
- **Query Helpers**: `getObjectsByBoxId()`, `removeObjectsByBoxId()`
- **Canvas Operations**: `renderAll()`, `setDimensions()`, `calcOffset()`
- **Event Management**: `on(event, handler)` - Event listener setup
- **State Checks**: `isInitialized()`, `getCanvas()` - Canvas state queries

### 4. `events.js` ✨ NEW
Centralized event system:
- **Event Constants**: `AppEvents` object with all event names
  - Canvas events: `TEXTBOX_MODIFIED`, `FONTSIZE_CHANGED`, `TEXTBOX_PROPERTY_CHANGED`
  - Image events: `REQUEST_LOCK`, `REQUEST_UNLOCK`
  - UI events: `MODE_CHANGED`
- **Helper Functions**:
  - `dispatchAppEvent(eventName, detail)` - Type-safe event dispatching
  - `onAppEvent(eventName, handler)` - Event listener with unsubscribe function

### 5. `state.js` ✨ ENHANCED - Unified State System
**Complete reactive state management for entire application**

**State Structure:**
```javascript
state = {
    image: { img, filename, scale, offsetX, offsetY },
    textBoxes: [...]
}
```

**State Notification System:**
- `subscribeToState(listener)` - Subscribe to any state change, returns unsubscribe function
- Automatic notification to all subscribers when state changes
- Triggers autosave automatically

**Image State Helpers:**
- `updateImage(updates)` - Update image properties (scale, offsets) and notify
- `setImage(img, filename, w, h)` - Set new image with calculated initial position
- `resetImage(w, h)` - Reset image to fit canvas

**Textbox State Helpers:**
- `addTextBox(box)` - Add textbox and notify
- `updateTextBox(id, updates)` - Update textbox and notify
- `removeTextBox(id)` - Remove textbox and notify
- `notifyChange()` - Manual notification (used by Fabric sync)

**Integration Points:**
- **FabricManager**: Fabric changes → `syncObjectsToState()` → `notifyChange()` → autosave
- **Image Manipulation**: All drag/pinch/wheel → `updateImage()` → notifyChange() → autosave
- **AutosaveManager**: Subscribes to state → automatically saves on any change

**Benefits:**
- ✅ **Single source of truth** - All app data in one place
- ✅ **Automatic autosave** - Never forget to trigger it
- ✅ **Reactive architecture** - Change state → effects happen automatically
- ✅ **Easy debugging** - Log all changes in one place
- ✅ **Future-proof** - Ready for undo/redo, sync, etc.

### 6. `domCache.js` ✨ NEW
**Performance-optimized DOM element caching system**

**DOMCache Class:**
- `get(id)` - Get element by ID (cached for performance)
- `getAll(selector)` - Get elements by selector (live NodeList, not cached)
- `has(id)` - Check if element exists
- `set(id, element)` - Manually cache element
- `remove(id)` - Remove from cache
- `clear()` - Clear entire cache
- `size` - Get cache size

**Helper Functions:**
- `getElements(...ids)` - Get multiple elements at once as object

**Benefits:**
- ✅ **Performance** - Elements cached after first lookup
- ✅ **Cleaner code** - No repetitive `document.getElementById()`
- ✅ **Centralized** - Single import across all modules
- ✅ **Easy to debug** - Can inspect cache size and contents

## Files Updated

### 1. `app.js`
- ✅ Removed local CONFIG object
- ✅ Imported from `config.js`: CANVAS_SIZES, INTERACTION_CONFIG, EXPORT_CONFIG
- ✅ Imported from `utils.js`: pickImageFile, loadImageFromFile
- ✅ Imported from `state.js`: state, subscribeToState, updateImage, setImage, resetImage
- ✅ Imported from `domCache.js`: dom
- ✅ Replaced all CONFIG.* references with INTERACTION_CONFIG.*
- ✅ Replaced magic strings with EXPORT_CONFIG constants
- ✅ **Replaced all `document.getElementById()` with `dom.get()`**
- ✅ **Using centralized events (AppEvents, onAppEvent)**
- ✅ **Using ES6 imports consistently** - No more dynamic imports
- ✅ **Improved object destructuring** in function parameters
- ✅ **Using Object.assign()** for cleaner style assignments
- ✅ **Complete state system integration**:
  - **Removed** local variables: `photoImg`, `photoFilename`, `scale`, `offsetX`, `offsetY`
  - **All image state** now in `state.image` object
  - **All interactions** (drag, pinch, wheel, keyboard) use `updateImage()`
  - **Automatic autosave** via state subscription (no manual triggers!)
  - **AutosaveManager** reads from `state.image` instead of local vars
  - **Draw function** simplified - no manual autosave calls

### 2. `textControls.js`
- ✅ Imported from `config.js`: PRESET_VALUES, COLORS
- ✅ Imported from `utils.js`: rgbToHex
- ✅ Imported from `state.js`: state, removeTextBox, notifyChange
- ✅ Imported from `domCache.js`: dom
- ✅ Replaced hardcoded preset sizes with PRESET_VALUES.FONT_SIZES
- ✅ Removed duplicate rgbToHex() function
- ✅ **Using centralized events (AppEvents, dispatchAppEvent, onAppEvent)**
- ✅ **Converted to async/await** for font loading (no more .then())
- ✅ **Extracted setupBgColorPanel() and populateFontPanel()** as async functions
- ✅ **Using state helpers for automatic autosave**:
  - `removeTextBox()` when deleting textbox
  - `notifyChange()` in syncObjectsToState()
- ✅ **NEW: Introduced `updateComplexProperty()` wrapper**:
  - Centralized handler for complex property updates (padding, offset, bgColor, bgOpacity)
  - Guarantees `syncObjectsToState()` and `notifyChange()` are always called
  - Reduces code duplication (removed 40+ lines)
  - Ensures state persistence on every change
  - Single source for sync/render logic

### 3. `textOverlay.js`
- ✅ Imported from `config.js`: TEXT_DEFAULTS, FABRIC_CONFIG, TEXTBOX_DEFAULTS, INTERACTION_CONFIG
- ✅ Imported from `utils.js`: generateId, loadFonts, snapToGrid
- ✅ Imported from `state.js`: state, notifyChange, addTextBoxToState
- ✅ Imported from `app.js`: resizeCanvas, setIsEditingText (specific functions, not `* as app`)
- ✅ Imported from `domCache.js`: dom
- ✅ **Replaced `document.getElementById()` with `dom.get()`**
- ✅ **Using ES6 imports consistently** - No more `import * as app`
- ✅ Replaced hardcoded textbox defaults with TEXT_DEFAULTS.*
- ✅ Replaced inline UUID generation with generateId()
- ✅ Replaced manual grid snapping with snapToGrid()
- ✅ **Using FabricManager class** for all canvas operations
- ✅ **Using centralized events** (AppEvents, dispatchAppEvent)
- ✅ **All TEXTBOX_DEFAULTS properly used** via getTextboxDefaults()
- ✅ **Integrated with state notification system**:
  - `syncObjectsToState()` calls `notifyChange()` after Fabric updates
  - `addTextBox()` uses `addTextBoxToState()` for automatic autosave
  - Removed old `debouncedAutosave()` - now handled by state system

## Benefits

### 1. **Single Source of Truth**
- All configuration values in one place
- Easy to find and modify settings
- No magic numbers scattered throughout code

### 2. **Better Maintainability**
- Change a value once, affects everywhere
- Clear naming makes intent obvious
- Easy to add new presets or configurations

### 3. **Reusability**
- Utility functions can be used across modules
- No code duplication (e.g., rgbToHex, generateId)
- Standard helpers for common tasks

### 4. **Testability**
- Pure utility functions are easy to test
- Configuration can be mocked for testing
- Clear separation of concerns

### 5. **Documentation**
- Config file acts as documentation of all app settings
- Utils file shows available helper functions
- Grouped by category for easy discovery

## Examples of Improvements

### Before:
```javascript
// Magic numbers scattered everywhere
textbox.left = Math.round(textbox.left / 10) * 10;
const box = {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    x: 240,
    y: 400,
    fontSize: 40,
    // ... more hardcoded values
};
```

### After:
```javascript
// Clean, configurable code
textbox.left = snapToGrid(textbox.left, INTERACTION_CONFIG.GRID_SIZE);
const box = {
    id: generateId(),
    x: TEXT_DEFAULTS.X,
    y: TEXT_DEFAULTS.Y,
    fontSize: TEXT_DEFAULTS.FONT_SIZE,
    // ... values from config
};
```


---

## 🎯 Final Architecture Overview

### **Three Core Systems Working Together:**

```
┌─────────────────────────────────────────────────────┐
│              USER INTERACTIONS                      │
│  (drag, pinch, wheel, keyboard, textbox edits)     │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│              STATE SYSTEM (state.js)                │
│  Single source of truth for all app data           │
│  • state.image (img, scale, offsetX, offsetY)      │
│  • state.textBoxes []                               │
│                                                      │
│  Helper functions (auto-notify):                    │
│  • updateImage() - Image transformations            │
│  • addTextBox(), removeTextBox() - Textbox CRUD     │
│  • notifyChange() - Manual trigger from Fabric      │
└────────────────┬────────────────────────────────────┘
                 │ notifyStateChange()
                 ↓
       ┌─────────┴──────────┐
       ↓                    ↓
┌─────────────┐      ┌─────────────────┐
│ DRAW()      │      │ AUTOSAVEMANAGER │
│ Renders UI  │      │ Saves to DB     │
│ from state  │      │ (debounced)     │
└─────────────┘      └─────────────────┘

PLUS (orthogonal concerns):

┌─────────────────────────────────────────────────────┐
│          FABRICMANAGER (fabricManager.js)           │
│  Manages Fabric.js canvas for text overlays        │
│  • Syncs textbox changes → state → autosave        │
│  • Encapsulates canvas operations                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│          EVENTS SYSTEM (events.js)                  │
│  Cross-cutting communication                        │
│  • REQUEST_LOCK/UNLOCK - Image locking              │
│  • FONTSIZE_CHANGED - UI updates                    │
│  • Custom event dispatching/listening               │
└─────────────────────────────────────────────────────┘
```

### **Key Benefits of This Architecture:**

1. **Automatic Autosave** ✨
   - ANY state change triggers autosave
   - No manual `autosaveManager.schedule()` calls needed
   - Image moves → autosave ✓
   - Textbox edits → autosave ✓
   - Deletions → autosave ✓

2. **Single Source of Truth** 📍
   - All data in `state` object
   - No scattered local variables
   - Easy to serialize/restore

3. **Reactive Updates** 🔄
   - Change state → effects happen automatically
   - Subscribe pattern allows multiple listeners
   - Future-ready for undo/redo

4. **Clean Separation** 🎯
   - **State**: Data layer
   - **FabricManager**: Canvas UI layer
   - **AutosaveManager**: Persistence layer
   - **Events**: Cross-cutting communication

5. **Maintainable** 🛠️
   - Centralized config (config.js)
   - Reusable utilities (utils.js)
   - Clear responsibilities
   - Professional patterns