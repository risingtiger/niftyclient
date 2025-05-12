/**
 * Returns a promise that resolves if the current day is Monday, Tuesday, or Friday.
 * Otherwise, the promise rejects.

 */
export function promise_a(): Promise<boolean> {
    return new Promise((res, rej) => {
        const date = new Date();
        const day = date.getDay();

        // 1 = Monday, 2 = Tuesday, 5 = Friday
        if (day === 1 || day === 2 || day === 5) {
            res(true);
        } else {
            rej(false);
        }
    });
}


/**
 * Returns a promise that resolves with the current day of the week as a string.
 * Rejects if it fails.
 */
export const promise_b = () => new Promise<string>((res, rej) => {

	const date = new Date();
	const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	const day = days[date.getDay()];

	if (day === "Sunday")
		rej()
	else
		res(day);
})

/**
 * Calls promise_b to get the current day and handles any errors
 */
export async function dealwithday() {
    let current_day:any;
    try { current_day = await promise_b(); }
    catch { console.log('failed'); }

	console.log(current_day);
}

