export const Slide = (old_view: HTMLElement, new_view: HTMLElement) => {

    old_view.dataset.active = "false";
    new_view.style.display = "block";

    const old_view_kf = [
        { transform: 'translate3d(0, 0, 0)' },
        { transform: 'translate3d(-100px, 0, 0)' }
    ];

    const new_view_kf = [
        { transform: 'translate3d(100%, 0, 0)' },
        { transform: 'translate3d(0, 0, 0)' }
    ];

    const old_view_opts: KeyframeAnimationOptions = {
        duration: 300,
        easing: 'ease-in',
        fill: 'forwards'
    };

    const new_view_opts: KeyframeAnimationOptions = {
        duration: 300,
        easing: 'ease-out',
        fill: 'forwards'
    };

    const old_animation = old_view.animate(old_view_kf, old_view_opts);
    const new_animation = new_view.animate(new_view_kf, new_view_opts);

    Promise.all([old_animation.finished, new_animation.finished]).then(() => {
        old_view.style.display = "none";
        
        old_animation.cancel();
        new_animation.cancel();

        new_view.dataset.active = "true";

        document.querySelector("#views")!.dispatchEvent(new Event("animationcomplete"));
    });
};

