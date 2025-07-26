
import {num, bool } from "../../../defs_server_symlink.js";

export type AnimateThemeT = { 
	duration: num, 
	start_time: num|null, 
	start_color: num, 
	start_range: num, 
	color_range: num  
}

let animate_theme_state: AnimateThemeT = { 
	duration: 0, 
	start_time: null, 
	start_color: 155, 
	start_range: 100, 
	color_range: 100 
}

let theme_color_meta: HTMLMetaElement | null = null




export function init_animation_state(meta_element: HTMLMetaElement) {
	theme_color_meta = meta_element
}




export const animate_in = (content_el: HTMLElement, viewwrapperel: HTMLElement) => new Promise<void>(async (res, _rej) => {

    content_el.style.opacity = '0';
    
    const content_keyframes = [
        { transform: 'translate3d(0, 20vh, 0)', opacity: 0 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
    ];
    
    const viewwrapperel_keyframes = [
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
        { transform: 'translate3d(0, 20px, 0) scale(0.92)', opacity: 0.7 }
    ];
    
    const animation_options = {
        duration: 560,
        easing: 'cubic-bezier(0, 0.850, 0.250, 1)',
        fill: 'forwards' as FillMode
    };
    
    animate_theme_and_body_color(animation_options.duration, false);

    const content_animation = content_el.animate(content_keyframes, animation_options);
    const viewwrapperel_animation = viewwrapperel.animate(viewwrapperel_keyframes, animation_options);
    
    await Promise.all([content_animation.finished, viewwrapperel_animation.finished]);
    
	res()
})




export const animate_out = async (content_el: HTMLElement, viewwrapperel: HTMLElement) => new Promise<void>(async (res, _rej) => {

    const content_keyframes = [
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        { transform: 'translate3d(0, 80vh, 0)', opacity: 0 }
    ];
    
    const viewwrapperel_keyframes = [
        { transform: 'translate3d(0, 20px, 0) scale(0.92)', opacity: 0.7 },
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
    ];
    
    const animation_options = {
        duration: 550,
        easing: 'cubic-bezier(0.250, 0, 1, 0.850)',
        fill: 'forwards' as FillMode
    };
    
    animate_theme_and_body_color(animation_options.duration, true);
    
    const content_animation = content_el.animate(content_keyframes, animation_options);
    const viewwrapperel_animation = viewwrapperel.animate(viewwrapperel_keyframes, animation_options);
    
    await Promise.all([content_animation.finished, viewwrapperel_animation.finished]);

	res()
})




function animate_theme_and_body_color(duration: number, is_out: bool = false) {
	animate_theme_state.duration = duration;
	animate_theme_state.start_time = null;

    animate_theme_state.start_color = is_out ? 155 : 255;
    const end_color = is_out ? 255 : 155;
    animate_theme_state.color_range = end_color - animate_theme_state.start_color;

    requestAnimationFrame(animate_theme_and_body_color__frame);
}




function set_theme_and_body_color_from_progress(progress: number) {
	const color_val = Math.round(animate_theme_state.start_color + animate_theme_state.color_range * progress);
	const color_str = `rgb(${color_val},${color_val},${color_val})`;

	if (theme_color_meta) {
		theme_color_meta.setAttribute("content", color_str);
	}
	document.body.style.backgroundColor = color_str;
}

function animate_theme_and_body_color__frame(current_time: number) {
	if (animate_theme_state.start_time === null) {
		animate_theme_state.start_time = current_time;
	}
	const elapsed = current_time - animate_theme_state.start_time;
	const progress = Math.min(elapsed / animate_theme_state.duration, 1);

	set_theme_and_body_color_from_progress(progress);

	if (progress < 1) {
		requestAnimationFrame(animate_theme_and_body_color__frame);
	}
}



