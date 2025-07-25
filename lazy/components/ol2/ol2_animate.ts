

export async function animate_in(thiscomponent: HTMLElement, background_wrapper: HTMLElement) {

    const content_el = thiscomponent.shadowRoot?.querySelector('.content') as HTMLElement;
    if (!content_el) return;

    // Set initial states
    thiscomponent.style.opacity = '1';
    content_el.style.opacity = '0';
    
    // Define animations
    const content_keyframes = [
        { transform: 'translate3d(0, 100vh, 0)', opacity: 0 },
        { transform: 'translate3d(0, 8vh, 0)', opacity: 1, offset: 0.65 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
    ];
    
    const background_keyframes = [
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
        { transform: 'translate3d(0, 20px, 0) scale(0.92)', opacity: 0.7 }
    ];
    
    const animation_options = {
        duration: 560,
        easing: 'cubic-bezier(0, 0.850, 0.250, 1)',
        fill: 'forwards' as FillMode
    };
    
    // Create animations
    const content_animation = content_el.animate(content_keyframes, animation_options);
    const background_animation = background_wrapper.animate(background_keyframes, animation_options);
    
    // Wait for animations to complete
    await Promise.all([
        content_animation.finished,
        background_animation.finished
    ]);
    
    // Show spacer and scroll into view
    const spacer_el = thiscomponent.shadowRoot?.querySelector('.spacer') as HTMLElement;
    if (spacer_el) {
        spacer_el.style.display = 'block';
    }
    
    background_wrapper.scrollIntoView();
    thiscomponent.setAttribute('opened', 'true');
}




export async function animate_out(overlay_el: HTMLElement, content_el: HTMLElement, wrapper_el: HTMLElement, shape: string) {
    // Get the background wrapper element
    
    const easing = shape === 'float' ? 'cubic-bezier(0.35, 0.15, 0.85, 0.64)' : 'cubic-bezier(0.46, 0.06, 1, 0.88)';
    
    // Define animations
    const content_keyframes = [
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        { transform: 'translate3d(0, 100vh, 0)', opacity: 0 }
    ];
    
    const background_keyframes = [
        { transform: 'translate3d(0, 20px, 0) scale(0.92)', opacity: 0.7 },
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
    ];
    
    const animation_options = {
        duration: 350,
        easing: easing,
        fill: 'forwards' as FillMode
    };
    
    // Create animations
    const animations: Animation[] = [content_el.animate(content_keyframes, animation_options)];
    
    if (wrapper_el) {
        animations.push(wrapper_el.animate(background_keyframes, animation_options));
    }
    
    // Remove active class
    wrapper_el.classList.remove('active');
    
    // Wait for animations to complete
    await Promise.all(animations.map(anim => anim.finished));
}
