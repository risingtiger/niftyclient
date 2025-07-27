
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


const CONTENT_TANSFORM_Y       = '20vh';
const VIEWWRAPPEREL_TANSFORM_Y = '5vh';
const VIEWWRAPPEREL_SCALE      = 0.92;
const VIEWWRAPPEREL_OPACITY    = 0.92;
const VIEWWRAPPEREL_SCALE_DIFF = 1 - VIEWWRAPPEREL_SCALE;
const VIEWWRAPPEREL_OPACITY_DIFF = 1 - VIEWWRAPPEREL_OPACITY;


let theme_color_meta: HTMLMetaElement | null = null
let isopen = false;
let isanimating = false;
let scroll_raf_id: number | null = null;
let last_scroll_progress: number = -1;
let is_shape_fill = true;




export function init_animation_state(meta_element: HTMLMetaElement, shape:string) {
	is_shape_fill = shape === "fill";
	theme_color_meta = meta_element
}


export function run_handle_scroll(
	componentel: HTMLElement,
	viewwrapperel: HTMLElement,
	onclosedcb: () => void
) {
	// Cancel any pending animation frame
	if (scroll_raf_id !== null) {
		cancelAnimationFrame(scroll_raf_id);
	}
	
	// Schedule update on next animation frame
	scroll_raf_id = requestAnimationFrame(() => {
		if (componentel.scrollTop < 20 && isopen) {
			set_theme_and_body_color_from_progress(0);
			set_viewwrapperel_from_progress(viewwrapperel, 0);
			isanimating = false;
			onclosedcb();

		} else {
			
			// Calculate progress based on scroll position (0 = top, 1 = fully scrolled)
			const max_scroll = componentel.scrollHeight - componentel.clientHeight;
			const scroll_progress = max_scroll > 0 ? Math.min(componentel.scrollTop / max_scroll, 1) : 0;
			
			// Only update if progress has changed
			if (scroll_progress !== last_scroll_progress) {
				last_scroll_progress = scroll_progress;
				set_theme_and_body_color_from_progress(scroll_progress);
				set_viewwrapperel_from_progress(viewwrapperel, scroll_progress);
			}
		}
		scroll_raf_id = null;
	});
}




export const animate_in = (content_el: HTMLElement, viewwrapperel: HTMLElement) => new Promise<void>(async (res, _rej) => {

	isanimating = true;

    content_el.style.opacity = '0';
    
    const content_keyframes = [
        { transform: `translate3d(0, ${CONTENT_TANSFORM_Y}, 0)`, opacity: 0 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
    ];
    
    const viewwrapperel_keyframes = [
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
        { transform: `translate3d(0, ${VIEWWRAPPEREL_TANSFORM_Y}, 0) scale(${VIEWWRAPPEREL_SCALE})`, opacity: String( VIEWWRAPPEREL_OPACITY ) }
    ];
    
    const animation_options = {
        duration: 560,
        easing: 'cubic-bezier(0, 0.850, 0.250, 1)'
    };

    const content_animation = content_el.animate(content_keyframes, animation_options);
    
	if (is_shape_fill) {
		animate_theme_and_body_color(animation_options.duration, false);
		viewwrapperel.animate(viewwrapperel_keyframes, animation_options);
	}

    
    await Promise.all([content_animation.finished]);

	content_el.style.transform = 'translate3d(0, 0, 0)';
	content_el.style.opacity = '1';

	if (is_shape_fill) {
		viewwrapperel.style.transform = `translate3d(0, ${VIEWWRAPPEREL_TANSFORM_Y}, 0) scale(${VIEWWRAPPEREL_SCALE})`;
		viewwrapperel.style.opacity = String(VIEWWRAPPEREL_OPACITY);
	}

    
	isopen = true;
	isanimating = false;
	res()
})




export const animate_out = async (content_el: HTMLElement, viewwrapperel: HTMLElement) => new Promise<void>(async (res, _rej) => {

	isanimating = true;

    const content_keyframes = [
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        { transform: `translate3d(0, ${CONTENT_TANSFORM_Y}, 0)`, opacity: 0 }
    ];
    
    const viewwrapperel_keyframes = [
        { transform: `translate3d(0, ${VIEWWRAPPEREL_TANSFORM_Y}, 0) scale(${VIEWWRAPPEREL_SCALE})`, opacity: String(VIEWWRAPPEREL_OPACITY) },
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
    ];
    
    const animation_options = {
        duration: 550,
        easing: 'cubic-bezier(0.250, 0, 1, 0.850)',
    };
    
	if (is_shape_fill) {
		animate_theme_and_body_color(animation_options.duration, true);
		viewwrapperel.animate(viewwrapperel_keyframes, animation_options);
	}
    
    const content_animation = content_el.animate(content_keyframes, animation_options);
    
    await Promise.all([content_animation.finished]);

	content_el.style.transform = `translate3d(0, ${CONTENT_TANSFORM_Y}, 0)`;
	content_el.style.opacity = '0';

	if (is_shape_fill) {
		viewwrapperel.style.transform = 'translate3d(0, 0, 0)'
		viewwrapperel.style.opacity = '1';
	}

	isanimating = false;

	res()
})




export const get_isanmiating = () =>  {
	return isanimating;
}




function set_theme_and_body_color_from_progress(progress: number) {
	const color_val = Math.round(animate_theme_state.start_color + animate_theme_state.color_range * progress);
	const color_str = `rgb(${color_val},${color_val},${color_val})`;

	if (theme_color_meta) {
		theme_color_meta.setAttribute("content", color_str);
	}
	document.body.style.backgroundColor = color_str;
}



function set_viewwrapperel_from_progress(viewwrapperel:HTMLElement, progress: number) {
	const scale = 1 - VIEWWRAPPEREL_SCALE_DIFF * progress;
	const translateY = 20 * progress;
	const opacity = 1 - VIEWWRAPPEREL_OPACITY_DIFF * progress;

	viewwrapperel.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
	viewwrapperel.style.opacity = opacity.toString();
}




function animate_theme_and_body_color(duration: number, is_out: bool = false) {
	animate_theme_state.duration = duration;
	animate_theme_state.start_time = null;

    animate_theme_state.start_color = is_out ? 155 : 255;
    const end_color = is_out ? 255 : 155;
    animate_theme_state.color_range = end_color - animate_theme_state.start_color;

    requestAnimationFrame(animate_theme_and_body_color__frame);
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



