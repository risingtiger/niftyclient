

import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { chromium, FullConfig } from '@playwright/test';


const STORAGE_DIR = path.resolve(process.cwd(), 'playwright/.auth');
const STORAGE_PATH = path.resolve(STORAGE_DIR, 'user.json');




async function Global_Setup(config: FullConfig) {
	const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3003';

	if (!existsSync(STORAGE_PATH)) {
		await mkdir(STORAGE_DIR, { recursive: true });
		await seed_storage(baseURL);
	}
}




async function seed_storage(baseURL: string) {
	const browser = await chromium.launch();
	const context = await browser.newContext();
	const page    = await context.newPage();

	await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

	await page.evaluate(({ token, refreshToken, email, expiry, group }) => {
		localStorage.setItem('id_token', token);
		localStorage.setItem('token_expires_at', expiry.toString());
		localStorage.setItem('refresh_token', refreshToken);
		localStorage.setItem('user_email', email);
		localStorage.setItem('auth_group', group);
	}, {
		token: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjdjNzQ5NTFmNjBhMDE0NzE3ZjFlMzA4ZDZiMjgwZjQ4ZjFlODhmZGEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vcHVyZXdhdGVydGVjaCIsImF1ZCI6InB1cmV3YXRlcnRlY2giLCJhdXRoX3RpbWUiOjE3NjQ4NzA0NDEsInVzZXJfaWQiOiJRQnZNeVFJNEFzWDdibXQ5M2V0YnNUeUd6UTIzIiwic3ViIjoiUUJ2TXlRSTRBc1g3Ym10OTNldGJzVHlHelEyMyIsImlhdCI6MTc2NDg3NjU5OCwiZXhwIjoxNzY0ODgwMTk4LCJlbWFpbCI6ImFjY291bnRzQHJpc2luZ3RpZ2VyLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImFjY291bnRzQHJpc2luZ3RpZ2VyLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.fVJsPDi4CiVw5xPiGnJ3fAfae0UXD6DzMtX3jQ32KRewOiiW5H-XjKlV6t4uJOka5vzDO-cjIud31O2ntA0SovLl2K8rrnyXLetLKUTyfLVDsnwGUml0_IsqWlQdEeo_T7E6WmG7Gmy20E4ePezwli6u1dB-5fQzc-RbjKDcF_1gUImCxQuAwlitAc5NdsoWqRo5s71XUSgtVw_I8QMzIfhyAFMmY4E3CNbFK_1YGFEedDbNDqTxx9gj9JBWsqcQZtwaD5vclUHT1uhnPQ8APQJgWM-70diy5ahXT4t3m88jEqk-b9crhzuhwQ-wIyBUiimZsVx7OcWdTNu_7COGiQ",
		refreshToken: "AMf-vBzBgs7bIPbxg4UZtNFaMx5NUKpFllF1lX_fYN2TJS13rgy4nb66CY3m93-675ps2sg8vCdfNi5E1KjRWQl52uF5wytOmuaz9dUZdux0sdY-St3S0DFjRsanZBXrOWYaonDuZKlmkMDsseWabev-S5tlCLPlnstEPVAwvE43qb1Vnpb1qpQMRwfBGKzKLXAjDdKp6FFJKL5F3F0B6FaJ96rwtAVHCg",
		email: "accounts@risingtiger.com",
		expiry: "1764880198",
		group: "admin"
	});

	await context.storageState({ path: STORAGE_PATH });
	await browser.close();
}







export default Global_Setup;

