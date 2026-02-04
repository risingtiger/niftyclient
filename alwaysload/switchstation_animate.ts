

export const SlidePhase1 = (current_view: HTMLElement): HTMLElement => {

	// Create and append spinner to body
	const spinner = document.createElement('div');
	spinner.className = 'view-transition-spinner phase1';
	document.body.appendChild(spinner);

	// Trigger Phase 1 shrink animation on current view
	current_view.classList.add('transition-phase1');

	return spinner;
};


export const SlidePhase2 = async (old_view: HTMLElement, new_view: HTMLElement, spinner: HTMLElement, new_title?: string) => new Promise<void>(async (res) => {

	const h1 = document.querySelector('#viewheader .middle h1') as HTMLElement | null;

	// Transition spinner to fade-out
	spinner.classList.remove('phase1');
	spinner.classList.add('phase2');

	// Start Phase 2 view transition
	const transition = (document as any).startViewTransition({update:() => {
		if (h1) h1.textContent = new_title;
		old_view.dataset.active = "false";
		new_view.dataset.active = "true";
	}, types: [ 'phase2-forwards' ]});

	await transition.finished;

	// Cleanup
	old_view.classList.remove('transition-phase1');
	spinner.remove();

	res();
});


export const Slide = async (previous_view: HTMLElement, next_view: HTMLElement, new_title?: string) => new Promise<void>(async (res) => {

	const h1 = document.querySelector('#viewheader .middle h1') as HTMLElement | null;

	const transition = (document as any).startViewTransition({update:() => {
		h1.textContent = new_title;
		previous_view.dataset.active       = "false";
		next_view.dataset.active           = "true";
	}, types: [ 'forwards' ]});

	await transition.finished;

	// document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));

	res();
});


export const SlideBack = async (current_view: HTMLElement, previous_view: HTMLElement, prev_title?: string) => new Promise<void>(async (res) => {

	const h1 = document.querySelector('#viewheader .middle h1') as HTMLElement | null;

	const transition = (document as any).startViewTransition({update:() => {
		h1.textContent = prev_title;
		previous_view.dataset.active   = "true";
		current_view.dataset.active    = "false";
	}, types: [ 'backwards' ]});

	await transition.finished;

	// document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));

	res();
});
