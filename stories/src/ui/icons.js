// Icon SVG imports - Vite will inline these at build time
import textModeIcon from '../assets/icons/text-mode.svg?raw';
import imageModeIcon from '../assets/icons/image-mode.svg?raw';
import addTextIcon from '../assets/icons/add-text.svg?raw';
import saveIcon from '../assets/icons/save.svg?raw';
import shareIcon from '../assets/icons/share.svg?raw';
import resetIcon from '../assets/icons/reset.svg?raw';
import deleteIcon from '../assets/icons/delete.svg?raw';
import toggleControlsIcon from '../assets/icons/toggle-controls.svg?raw';
import size916Icon from '../assets/icons/size-9-16.svg?raw';
import size34Icon from '../assets/icons/size-3-4.svg?raw';
import fontFamilyIcon from '../assets/icons/font-family.svg?raw';
import fontSizeIcon from '../assets/icons/font-size.svg?raw';
import fontWeightIcon from '../assets/icons/font-weight.svg?raw';
import textColorIcon from '../assets/icons/text-color.svg?raw';
import textAlignIcon from '../assets/icons/text-align.svg?raw';
import lineHeightIcon from '../assets/icons/line-height.svg?raw';
import charSpacingIcon from '../assets/icons/char-spacing.svg?raw';
import bgColorIcon from '../assets/icons/bg-color.svg?raw';
import bgOpacityIcon from '../assets/icons/bg-opacity.svg?raw';
import paddingIcon from '../assets/icons/padding.svg?raw';
import offsetIcon from '../assets/icons/offset.svg?raw';

// Map icon names to imported SVG strings
export const icons = {
  textMode: textModeIcon,
  imageMode: imageModeIcon,
  addText: addTextIcon,
  save: saveIcon,
  share: shareIcon,
  reset: resetIcon,
  delete: deleteIcon,
  toggleControls: toggleControlsIcon,
  size916: size916Icon,
  size34: size34Icon,
  fontFamily: fontFamilyIcon,
  fontSize: fontSizeIcon,
  fontWeight: fontWeightIcon,
  textColor: textColorIcon,
  textAlign: textAlignIcon,
  lineHeight: lineHeightIcon,
  charSpacing: charSpacingIcon,
  bgColor: bgColorIcon,
  bgOpacity: bgOpacityIcon,
  padding: paddingIcon,
  offset: offsetIcon
};

/**
 * Set button's innerHTML to icon SVG
 * @param {HTMLElement} button - Button element
 * @param {string} iconName - Icon name from icons object
 */
export function setButtonIcon(button, iconName) {
  if (!button) {
    console.warn('setButtonIcon: button element is null');
    return;
  }
  
  if (!icons[iconName]) {
    console.warn(`setButtonIcon: Icon not found: ${iconName}`);
    return;
  }
  
  button.innerHTML = icons[iconName];
}

/**
 * Create icon element
 * @param {string} iconName - Icon name from icons object
 * @param {string} className - Optional CSS class
 * @returns {SVGElement|null}
 */
export function createIconElement(iconName, className = '') {
  if (!icons[iconName]) {
    console.warn(`createIconElement: Icon not found: ${iconName}`);
    return null;
  }
  
  const div = document.createElement('div');
  div.innerHTML = icons[iconName];
  const svg = div.firstElementChild;
  
  if (className) {
    svg.setAttribute('class', className);
  }
  
  return svg;
}

/**
 * Replace img src with inline SVG
 * @param {HTMLImageElement} img - Image element to replace
 * @param {string} iconName - Icon name from icons object
 */
export function replaceImgWithIcon(img, iconName) {
  if (!img || !icons[iconName]) return;
  
  const svg = createIconElement(iconName, img.className);
  if (svg && img.parentNode) {
    img.parentNode.replaceChild(svg, img);
  }
}

/**
 * Initialize all icon images in the document
 * Replaces <img src="..."> with inline SVG
 */
export function initializeIcons() {
  // Map of icon filenames to icon names
  const iconMap = {
    'text-mode.svg': 'textMode',
    'image-mode.svg': 'imageMode',
    'add-text.svg': 'addText',
    'save.svg': 'save',
    'share.svg': 'share',
    'reset.svg': 'reset',
    'delete.svg': 'delete',
    'toggle-controls.svg': 'toggleControls',
    'size-9-16.svg': 'size916',
    'size-3-4.svg': 'size34',
    'font-family.svg': 'fontFamily',
    'font-size.svg': 'fontSize',
    'font-weight.svg': 'fontWeight',
    'text-color.svg': 'textColor',
    'text-align.svg': 'textAlign',
    'line-height.svg': 'lineHeight',
    'char-spacing.svg': 'charSpacing',
    'bg-color.svg': 'bgColor',
    'bg-opacity.svg': 'bgOpacity',
    'padding.svg': 'padding',
    'offset.svg': 'offset'
  };
  
  // Find all img elements with icon paths
  document.querySelectorAll('img[src]').forEach(img => {
    const src = img.getAttribute('src');
    if (!src) return;
    
    // Extract filename from various path formats
    const filename = src.split('/').pop().split('?')[0];
    const iconName = iconMap[filename];
    
    if (iconName && icons[iconName]) {
      replaceImgWithIcon(img, iconName);
    }
  });
}