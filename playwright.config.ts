

import { defineConfig } from '@playwright/test';


export default defineConfig({
	testDir: './playwright/tests',
	timeout: 60_000,
	expect: {
		timeout: 10_000
	},
	retries: 0,
	use: {
		baseURL: 'http://localhost:3004',
		headless: true,
		trace: 'on-first-retry',
		storageState: 'playwright/.auth/user.json'
	},
	globalSetup: './playwright/global-setup.ts',
	reporter: [['html', { open: 'never' }]]
});
