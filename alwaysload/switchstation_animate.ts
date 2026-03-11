

export const SlidePhase1 = (current_view: HTMLElement) => new Promise<void>((res) => {


	const originY = window.scrollY + window.innerHeight / 2;
	current_view.style.transformOrigin = `0px ${originY}px`;

	current_view.classList.add('transition-phase1');

	current_view.onanimationend = () => {
		current_view.onanimationend = null;
		res();
	}
});


export const SlidePhase2 = async (old_view: HTMLElement, new_view: HTMLElement, new_title?: string) => new Promise<void>(async (res) => {

	const h1 = document.querySelector('#viewheader .middle h1') as HTMLElement | null;

	const transition = (document as any).startViewTransition({update:() => {
		if (h1) h1.textContent = new_title;
		old_view.dataset.active = "false";
		new_view.dataset.active = "true";
		window.scrollTo(0, 0);
	}, types: [ 'phase2-forwards' ]});

	await transition.finished;

	res();
});



// export const Slide = async (previous_view: HTMLElement, next_view: HTMLElement, new_title?: string) => new Promise<void>(async (res) => {
//
// 	const h1 = document.querySelector('#viewheader .middle h1') as HTMLElement | null;
//
// 	const transition = (document as any).startViewTransition({update:() => {
// 		h1.textContent = new_title;
// 		previous_view.dataset.active       = "false";
// 		next_view.dataset.active           = "true";
// 	}, types: [ 'forwards' ]});
//
// 	await transition.finished;
//
// 	// document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));
//
// 	res();
// });



export const SlideBack = async (current_view: HTMLElement, previous_view: HTMLElement, prev_title?: string, scrollY?: number) => new Promise<void>(async (res) => {

	const h1 = document.querySelector('#viewheader .middle h1') as HTMLElement | null;

	const transition = (document as any).startViewTransition({update:() => {
		h1.textContent = prev_title;
		previous_view.dataset.active   = "true";
		current_view.dataset.active    = "false";
		window.scrollTo(0, scrollY ?? 0);
	}, types: [ 'backwards' ]});

	await transition.finished;

	// document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));

	res();
});
