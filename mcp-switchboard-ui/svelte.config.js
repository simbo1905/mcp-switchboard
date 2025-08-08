import adapterAuto from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use static adapter for browser testing when STATIC_BUILD=true
		adapter: process.env.STATIC_BUILD === 'true' ? adapterStatic({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		}) : adapterAuto(),
		paths: {
			// Use relative paths for static builds to work with file:// protocol
			base: '',
			relative: process.env.STATIC_BUILD === 'true'
		}
	}
};

export default config;
