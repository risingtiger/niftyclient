


export const Slide = async (old_view: HTMLElement, new_view: HTMLElement) => {

    // Set initial states and performance hints
    new_view.style.opacity       = '1';
    new_view.style.transform     = 'translate3d(100vw, 0, 0)';
    new_view.style.willChange    = 'transform';
    old_view.style.willChange    = 'transform';
	old_view.style.pointerEvents = 'none';
	new_view.style.pointerEvents = 'none';

    const old_view_kf = [
        { offset: 0, transform: 'translate3d(0, 0, 0)' },
        { offset: 1, transform: 'translate3d(-33vw, 0, 0)' }
    ];

    const new_view_kf = [
        { offset: 0, transform: 'translate3d(100vw, 0, 0)' },
        { offset: 1, transform: 'translate3d(0, 0, 0)' }
    ];

    const animation_opts: KeyframeAnimationOptions = {
        duration: 350,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'forwards'
    };

    const old_animation = old_view.animate(old_view_kf, animation_opts);
    const new_animation = new_view.animate(new_view_kf, animation_opts);

    Promise.all([old_animation.finished, new_animation.finished]).then(() => {
		// Commit final positions to inline styles before cancelling animations
		new_view.style.transform     = 'translate3d(0, 0, 0)';
		old_view.style.transform     = 'translate3d(-33vw, 0, 0)';
		new_animation.cancel();
		old_animation.cancel();

		// Use visibility instead of display for better performance
		old_view.style.visibility    = "hidden";
		old_view.dataset.active      = "false";
		
		// Clean up will-change to free memory
		old_view.style.willChange    = 'auto';
		new_view.style.willChange    = 'auto';
		old_view.style.pointerEvents = 'auto';
		new_view.style.pointerEvents = 'auto';

		new_view.dataset.active      = "true";

		document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));
    });
};


export const SlideBack = async (current_view: HTMLElement, previous_view: HTMLElement) => {

    // Prepare views for animation
    previous_view.style.visibility    = "visible";
    previous_view.style.willChange    = 'transform';
    current_view.style.willChange     = 'transform';
	current_view.style.pointerEvents  = 'none';
	previous_view.style.pointerEvents = 'none';

    const current_view_kf = [
        { transform: 'translate3d(0, 0, 0)' },
        { transform: 'translate3d(100vw, 0, 0)' }
    ];

    const previous_view_kf = [
        // previous_view was left at this state by the forward animation
        { offset: 0, transform: 'translate3d(-33vw, 0, 0)' },
        { offset: 1, transform: 'translate3d(0, 0, 0)' }
    ];

    const animation_opts: KeyframeAnimationOptions = {
        duration: 350,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'forwards'
    };

    const current_animation = current_view.animate(current_view_kf, animation_opts);
    const previous_animation = previous_view.animate(previous_view_kf, animation_opts);

    Promise.all([current_animation.finished, previous_animation.finished]).then(() => {

		// Commit final positions to inline styles before cancelling animations
		current_view.style.transform      = 'translate3d(100vw, 0, 0)';
		previous_view.style.transform     = 'translate3d(0, 0, 0)';
		current_animation.cancel();
		previous_animation.cancel();

		
		current_view.style.willChange     = 'auto';
		previous_view.style.willChange    = 'auto';
		current_view.style.pointerEvents  = 'auto';
		previous_view.style.pointerEvents = 'auto';

		current_view.dataset.active       = "false";
		previous_view.dataset.active      = "true";

		document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));
	});
};

