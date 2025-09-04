


export const Slide = async (old_view: HTMLElement, new_view: HTMLElement) => {

    // Set initial states and performance hints
    new_view.style.opacity = '0';
    new_view.style.transform = 'translate3d(10vw, 0, 0)';
    new_view.style.willChange = 'transform, opacity';
    old_view.style.willChange = 'transform, opacity';

    const old_view_kf = [
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        { transform: 'translate3d(-10vw, 0, 0)', opacity: 0.8 }
    ];

    const new_view_kf = [
        { transform: 'translate3d(10vw, 0, 0)', opacity: 0 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
    ];

    const old_view_opts: KeyframeAnimationOptions = {
        duration: 300,
        easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        fill: 'forwards'
    };

    const new_view_opts: KeyframeAnimationOptions = {
        duration: 300,
        easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        fill: 'forwards',
        delay: 50 // Slight stagger for smoother transition
    };

    const old_animation = old_view.animate(old_view_kf, old_view_opts);
    const new_animation = new_view.animate(new_view_kf, new_view_opts);

    Promise.all([old_animation.finished, new_animation.finished]).then(() => {
        // Use visibility instead of display for better performance
        old_view.style.visibility = "hidden";
        old_view.dataset.active = "false";
        
        // Clean up will-change to free memory
        old_view.style.willChange = 'auto';
        new_view.style.willChange = 'auto';

        new_view.dataset.active = "true";

        document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));
    });
};

export const SlideBack = async (current_view: HTMLElement, previous_view: HTMLElement) => {

    // Prepare views for animation
    previous_view.style.visibility = "visible";
    previous_view.style.willChange = 'transform, opacity';
    current_view.style.willChange = 'transform, opacity';

    const current_view_kf = [
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        { transform: 'translate3d(10vw, 0, 0)', opacity: 0 }
    ];

    const previous_view_kf = [
        // previous_view was left at this state by the forward animation
        { transform: 'translate3d(-10vw, 0, 0)', opacity: 0.8 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
    ];

    const current_view_opts: KeyframeAnimationOptions = {
        duration: 300,
        easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        fill: 'forwards'
    };

    const previous_view_opts: KeyframeAnimationOptions = {
        duration: 300,
        easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        fill: 'forwards',
        delay: 50 // Stagger incoming view
    };

    const current_animation = current_view.animate(current_view_kf, current_view_opts);
    const previous_animation = previous_view.animate(previous_view_kf, previous_view_opts);

    await Promise.all([current_animation.finished, previous_animation.finished]);
    
    current_view.style.willChange = 'auto';
    previous_view.style.willChange = 'auto';

    current_view.dataset.active = "false";
    previous_view.dataset.active = "true";

    document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));
};

