




/*
export async function animate_out(content_el: HTMLElement, viewwrapperel: HTMLElement, shape: string) {
    
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
    
    if (viewwrapperel) {
        animations.push(viewwrapperel.animate(background_keyframes, animation_options));
    }
    
    // Remove active class
    viewwrapperel.classList.remove('active');
    
    // Wait for animations to complete
    await Promise.all(animations.map(anim => anim.finished));
}
*/



