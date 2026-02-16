// Import fonts directly with Vite
// This will bundle them and use correct paths
import merriweatherRegularUrl from '../assets/fonts/Merriweather-Regular.woff2';

export const FONTS = [
	{ 
		name: 'Merriweather', 
		family: 'Merriweather', 
		weight: 400,
		url: merriweatherRegularUrl // Use imported URL
	},
    { name: 'System', family: 'system-ui' },
    { name: 'Arial', family: 'Arial, sans-serif' },
    { name: 'Helvetica', family: 'Helvetica, sans-serif' },
    { name: 'Times New Roman', family: '"Times New Roman", serif' },
    { name: 'Georgia', family: 'Georgia, serif' },
    { name: 'Verdana', family: 'Verdana, sans-serif' },
    { name: 'Trebuchet', family: '"Trebuchet MS", sans-serif' },
    { name: 'Courier New', family: '"Courier New", monospace' },
    { name: 'Comic Sans', family: '"Comic Sans MS", cursive' },
    { name: 'Impact', family: 'Impact, sans-serif' },
    { name: 'Palatino', family: '"Palatino Linotype", serif' },
    { name: 'Garamond', family: 'Garamond, serif' },
    { name: 'Bookman', family: '"Bookman Old Style", serif' },
    { name: 'Tahoma', family: 'Tahoma, sans-serif' },
    { name: 'Lucida', family: '"Lucida Sans Unicode", sans-serif' },
    { name: 'Roboto', family: 'Roboto, sans-serif' },
    { name: 'Open Sans', family: '"Open Sans", sans-serif' },
    { name: 'Montserrat', family: 'Montserrat, sans-serif' },
    { name: 'Lato', family: 'Lato, sans-serif' }
];

// Adapted loader for Vite
export async function loadCustomFonts() {
	const promises = FONTS.filter(font => font.url).map(async font => {
		try {
			const fontFace = new FontFace(font.family, `url(${font.url})`, { weight: font.weight });
			const loaded = await fontFace.load();
			document.fonts.add(loaded);
			return loaded;
		} catch (err) {
			console.warn(`Failed to load font ${font.name}:`, err);
		}
	});
	return Promise.all(promises);
}
