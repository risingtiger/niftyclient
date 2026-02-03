

export const Slide = async (previous_view: HTMLElement, next_view: HTMLElement, new_title?: string) => {

	const h1 = document.querySelector('#viewheader .middle h1') as HTMLElement | null;

	const transition = (document as any).startViewTransition({update:() => {
		h1.textContent = new_title;
		previous_view.dataset.active       = "false";
		next_view.dataset.active           = "true";
	}, types: [ 'forwards' ]});

	await transition.finished;

	document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));

	return;
};


export const SlideBack = async (current_view: HTMLElement, previous_view: HTMLElement, prev_title?: string) => {

	const h1 = document.querySelector('#viewheader .middle h1') as HTMLElement | null;

	const transition = (document as any).startViewTransition({update:() => {
		previous_view.dataset.active   = "true";
		current_view.dataset.active    = "false";
		h1.textContent = prev_title;
	}, types: [ 'backwards' ]});

	await transition.finished;

	document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));
};
