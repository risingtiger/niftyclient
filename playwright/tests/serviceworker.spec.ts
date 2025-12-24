

import { expect, test, Page } from '@playwright/test';
import { PRELOAD_BASE_ASSETS_T } from '../../defs.js'

declare const APPVERSION: number;




test('cache test', async ({ page }) => {
	await page.goto('v/testassist');
	await page.waitForSelector('#views > v-testassist[data-active="true"]');

	let is_cached_a = await getdummyapidata_cachetest(page);
	console.log(`First Fetch 0s cache state: ${is_cached_a}`);

	await page.waitForTimeout(500);

	let is_cached_b = await getdummyapidata_cachetest(page); 
	console.log(`Second Fetch cache state: ${is_cached_b}`);

	await page.waitForTimeout(500);

	let is_cached_c = await getdummyapidata_cachetest(page); 
	console.log(`Third Fetch cache state: ${is_cached_c}`);

	await page.waitForTimeout(3000);

	let is_cached_d = await getdummyapidata_cachetest(page); 
	console.log(`Fourth Fetch cache state: ${is_cached_d}`);

	console.log('Asserting if cache states are: a=fresh, b=cached, c=cached, d=cache expired');
	console.log('cache is set to expire in 3 seconds. first fetch is always fresh. second and third are within cache time. fourth is after cache expiry.');
	expect([is_cached_a, is_cached_b, is_cached_c, is_cached_d]).toEqual([false, true, true, false]);

	await page.waitForTimeout(1000);

	let cache_exists_a = await cache_key_exists(page);
	console.log(`Cache key existence after expiry time but before periodic cleanup: ${cache_exists_a}`);

	await page.waitForTimeout(12000); // wait for periodic cleanup to run (which runs every 15s)

	let cache_exists_b = await cache_key_exists(page);
	console.log(`Cache key existence after periodic cleanup: ${cache_exists_b}`);

	expect([ cache_exists_a, cache_exists_b ]).toEqual([ true, false ]);
});




test('preload base assets cache test', async ({ page }) => {
	await page.goto('v/testassist');
	await page.waitForSelector('#views > v-testassist[data-active="true"]');

	// Wait for DELAY_PRELOAD_BASE_ASSETS (10s) + some buffer for fetch completion
	await page.waitForTimeout(15000);

	const PRELOAD_BASE_ASSETS:PRELOAD_BASE_ASSETS_T[] = [
		"/v/appmsgs",
		"/v/login",
		"/v/home",
		"/",
	];

	const cachedAssets = await page.evaluate(async (assets: string[]): Promise<{ url: string; cached: boolean }[]> => {
		const cache = await caches.open(`cacheV__${APPVERSION}__`);
		const results: { url: string; cached: boolean }[] = [];

		for (const url of assets) {
			const response = await cache.match(url);
			results.push({ url, cached: response !== undefined });
		}

		return results;
	}, PRELOAD_BASE_ASSETS);

	console.log('Preload base assets cache check results:');
	cachedAssets.forEach(({ url, cached }) => {
		console.log(`  ${url}: ${cached ? 'cached' : 'NOT cached'}`);
	});

	const allCached = cachedAssets.every(({ cached }) => cached);
	expect(allCached).toBe(true);
});




async function getdummyapidata_cachetest(page: Page): Promise<boolean> {

	const is_cached = await page.evaluate(async () : Promise<boolean> => {
		const result:any = await (window as any).$N.FetchLassie('/api/testdata', { method: 'GET' }, { cacheit: '3s' });
		return result.headers?.has('Nifty-Is-Cache') ?? false;
	});

	return is_cached;
}


async function cache_key_exists(page: Page): Promise<boolean> {
	return await page.evaluate(async (): Promise<boolean> => {
		const cache = await caches.open(`cacheV__${APPVERSION}__`);
		const response = await cache.match(new Request('/api/testdata', { method: 'GET' }));
		return response !== undefined;
	});
}


async function set_test_logging_true(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const registration = await navigator.serviceWorker.ready;
		registration.active?.postMessage({
			action: "set_test_logging_true",
		});
	});
}



