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
import radiusIcon from '../assets/icons/radius.svg?raw';

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
  offset: offsetIcon,
  radius: radiusIcon
};

/**
 * Set element's innerHTML to icon SVG
 * @param {HTMLElement} element - Element with data-icon attribute
 * @param {string} iconName - Icon name from icons object
 */
export function setElementIcon(element, iconName) {
  if (!element) {
    console.warn('setElementIcon: element is null');
    return;
  }
  
  if (!icons[iconName]) {
    console.warn(`setElementIcon: Icon not found: ${iconName}`);
    return;
  }
  
  element.innerHTML = icons[iconName];
}

/**
 * Set button's innerHTML to icon SVG
 * @param {HTMLElement} button - Button element
 * @param {string} iconName - Icon name from icons object
 * @deprecated Use setElementIcon instead
 */
export function setButtonIcon(button, iconName) {
  setElementIcon(button, iconName);
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
 * Initialize all icon elements in the document
 * Replaces <span data-icon="iconName"> with inline SVG
 */
export function initializeIcons() {
  // Find all elements with data-icon attribute
  document.querySelectorAll('[data-icon]').forEach(element => {
    const iconName = element.getAttribute('data-icon');
    
    if (iconName && icons[iconName]) {
      element.innerHTML = icons[iconName];
    } else if (iconName) {
      console.warn(`Icon not found: ${iconName}`);
    }
  });
}