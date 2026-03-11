import {num, bool } from "../../../defs_server_symlink.js";

export enum ShapeE { FILL = "fill", FLOAT = "float" }
export enum FloatShapeSizeE { S = 's', M = 'm', L = 'l', NA = 'na' }

type AnimateThemeT = { 
	duration: num, 
	start_time: num|null, 
	start_color: num, 
	start_range: num, 
	color_range: num  
}

type ComponentElT = HTMLElement & { 
	m: { shape: ShapeE }, 
	isopen: bool,
	isanimating: bool,
	scroll_raf_id: number|null,
	last_scroll_progress: num
	animation_theme_state: AnimateThemeT
}

let _theme_color_meta: HTMLMetaElement | null = null
let _current_componentel: ComponentElT | null = null

const CONTENT_TRANSFORM_FILL_Y  = '30vh';
const CONTENT_TRANSFORM_FLOAT_Y = '6vh';
const VIEWWRAPPEREL_TRANSFORM_Y = '1vh';
const VIEWWRAPPEREL_SCALE      = 0.98;
const VIEWWRAPPEREL_FILL_OPACITY   = 0.0;
const VIEWWRAPPEREL_FLOAT_OPACITY  = 0.4;
const VIEWWRAPPEREL_SCALE_DIFF = 1 - VIEWWRAPPEREL_SCALE;
const VIEWWRAPPEREL_OPACITY_DIFF = 1 - VIEWWRAPPEREL_FILL_OPACITY;
const VIEWHEADEREL_BLUR = 3;


let _viewheaderel: HTMLElement | null = null
let _viewwrapperel: HTMLElement | null = null


const _main_animation_options = {
	duration: 300,
	//easing: 'cubic-bezier(.03,.7,.4,1)',
	// easing: 'cubic-bezier(.21,.55,.48,1)',
	easing: 'cubic-bezier(.27,.28,.48,1)',
	fill: 'forwards' as const,
};
const _viewheader_animation_options = {
	duration: 300,
	easing: 'cubic-bezier(.42,.1,.47,.94)',
	fill: 'forwards' as const,
};




async function init_animation_state(componentel: ComponentElT ) {

	_theme_color_meta    = document.head.querySelector("meta[name = 'theme-color']")!;
	_current_componentel = componentel;
	_viewheaderel        = document.getElementById('viewheader');
	_viewwrapperel       = ( document.querySelector('#views > .view:last-child') as any ).shadowRoot.querySelector(':host > .wrapper');

	componentel.isopen = false;
	componentel.isanimating = false;
	componentel.last_scroll_progress = -1;
	componentel.scroll_raf_id = null;
	componentel.animation_theme_state = {
		duration: 0,
		start_time: null,
		start_color: 255,
		start_range: 100,
		color_range: -100
	};

	if (componentel.m.shape === ShapeE.FILL) {
		await util_await_scrollheight(componentel);
		const targetScroll    = Math.round(componentel.scrollHeight / 2);
		componentel.scrollTop = targetScroll;
	}

	return
}




function run_handle_scroll(componentel: ComponentElT, onclosedcb: () => void) {

	if (!componentel.isopen)
		return;

	// Cancel any pending animation frame
	if (componentel.scroll_raf_id !== null) {
		cancelAnimationFrame(componentel.scroll_raf_id);
	}

	_viewheaderel!.style.display = '';
	_viewheaderel!.offsetWidth; // Force reflow
	
	// Schedule update on next animation frame
	componentel.scroll_raf_id = requestAnimationFrame(() => {
		if (componentel.scrollTop < 20 && componentel.isopen && !componentel.isanimating) {
			//set_theme_and_body_color_from_progress(0);
			set_viewwrapperel_from_progress(0);
			if (_viewwrapperel) {
				_viewwrapperel.style.transformOrigin = '';
			}
			if (_viewheaderel) {
				_viewheaderel.style.transformOrigin = '';
			}
			componentel.isanimating = false;
			onclosedcb();

		} else {
			
			// Calculate progress based on scroll position (0 = top, 1 = fully scrolled)
			const max_scroll = componentel.scrollHeight - componentel.clientHeight;
			const scroll_progress = max_scroll > 0 ? Math.min(componentel.scrollTop / max_scroll, 1) : 0;
			
			// Only update if progress has changed
			if (scroll_progress !== componentel.last_scroll_progress) {
				componentel.last_scroll_progress = scroll_progress;
				set_viewwrapperel_from_progress(scroll_progress);
			}
		}
		componentel.scroll_raf_id = null;
	});
}




const animate_in = (componentel: ComponentElT, content_el:HTMLElement) => new Promise<void>(async (res, _rej) => {

	componentel.isanimating = true;

    content_el.style.opacity = '0';

	_viewheaderel.style.transformOrigin = 'center bottom';
	_viewwrapperel.style.transformOrigin = 'center top';

	const content_transform_y = componentel.m.shape === ShapeE.FILL ? CONTENT_TRANSFORM_FILL_Y : CONTENT_TRANSFORM_FLOAT_Y;
	const viewwrap_opacity = componentel.m.shape === ShapeE.FILL ? VIEWWRAPPEREL_FILL_OPACITY : VIEWWRAPPEREL_FLOAT_OPACITY;
	const viewheader_opacity = componentel.m.shape === ShapeE.FILL ? VIEWWRAPPEREL_FILL_OPACITY : 0.01;
    
    const content_keyframes = [
        { transform: `translate3d(0, ${content_transform_y}, 0)`, opacity: 0 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
    ];
    
    const viewwrapperel_keyframes = [
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
        { transform: `translate3d(0, ${VIEWWRAPPEREL_TRANSFORM_Y}, 0) scale(${VIEWWRAPPEREL_SCALE})`, opacity: String( viewwrap_opacity ) }
    ];
    const viewheader_keyframes = [
        { transform: 'translate3d(0, 0, 0)', opacity: 1, filter: 'blur(0px)' },
        { transform: `translate3d(0, ${VIEWWRAPPEREL_TRANSFORM_Y}, 0)`, opacity: String( viewheader_opacity ), filter: `blur(${VIEWHEADEREL_BLUR}px)` }
    ];

    const content_animation = content_el.animate(content_keyframes, _main_animation_options);
	const viewwrapperel_animation = _viewwrapperel?.animate(viewwrapperel_keyframes, _main_animation_options);
	const viewheaderel_animation = _viewheaderel?.animate(viewheader_keyframes, _viewheader_animation_options);
    
	if (componentel.m.shape === ShapeE.FILL) {
		//animate_theme_and_body_color(animation_options.duration, false);
	}

    await Promise.all([content_animation.finished, viewwrapperel_animation?.finished, viewheaderel_animation?.finished]);
    //await Promise.all([content_animation.finished, viewwrapperel_animation?.finished]);

	content_el.style.transform = 'translate3d(0, 0, 0)';
	content_el.style.opacity = '1';

	_viewwrapperel.style.transform = `translate3d(0, ${VIEWWRAPPEREL_TRANSFORM_Y}, 0) scale(${VIEWWRAPPEREL_SCALE})`;
	_viewwrapperel.style.opacity = String(viewwrap_opacity);

	_viewheaderel.style.transform = `translate3d(0, ${VIEWWRAPPEREL_TRANSFORM_Y}, 0)`;
	_viewheaderel.style.opacity = String(viewwrap_opacity);
	_viewheaderel.style.filter = `blur(${VIEWHEADEREL_BLUR}px)`;
	_viewheaderel.style.display = `none`;


	content_animation.cancel();
	viewwrapperel_animation?.cancel();
	viewheaderel_animation?.cancel();
    
	componentel.isopen = true;
	componentel.isanimating = false;

	res()
})




const animate_out = async (componentel:ComponentElT, content_el: HTMLElement ) => new Promise<void>(async (res, _rej) => {

	componentel.isanimating = true;

	const content_transform_y = componentel.m.shape === ShapeE.FILL ? CONTENT_TRANSFORM_FILL_Y : CONTENT_TRANSFORM_FLOAT_Y;
	const viewwrap_opacity = componentel.m.shape === ShapeE.FILL ? VIEWWRAPPEREL_FILL_OPACITY : VIEWWRAPPEREL_FLOAT_OPACITY;

    const content_keyframes = [
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        { transform: `translate3d(0, ${content_transform_y}, 0)`, opacity: 0 }
    ];
    const viewwrapperel_keyframes = [
        { transform: `translate3d(0, ${VIEWWRAPPEREL_TRANSFORM_Y}, 0) scale(${VIEWWRAPPEREL_SCALE})`, opacity: String(viewwrap_opacity) },
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
    ];
    const viewheader_keyframes = [
        { transform: `translate3d(0, ${VIEWWRAPPEREL_TRANSFORM_Y}, 0)`, opacity: String( viewwrap_opacity ), filter: `blur(${VIEWHEADEREL_BLUR}px)` },
        { transform: `translate3d(0,0,0)`, opacity: 1, filter: 'blur(0px)' }
    ];
    
	if (componentel.m.shape === ShapeE.FILL) {
		//animate_theme_and_body_color(animation_options.duration, true);
	}

	_viewheaderel.style.display = '';
	_viewheaderel.offsetWidth;

	const viewwrapperel_animation = _viewwrapperel?.animate(viewwrapperel_keyframes, _main_animation_options);
	const viewheaderel_animation = _viewheaderel?.animate(viewheader_keyframes, _viewheader_animation_options);
    const content_animation = content_el.animate(content_keyframes, _main_animation_options);
    
    await Promise.all([content_animation.finished, viewwrapperel_animation?.finished, viewheaderel_animation?.finished]);

	content_el.style.transform = `translate3d(0, ${content_transform_y}, 0)`;
	content_el.style.opacity = '0';
	if (_viewwrapperel) {
		_viewwrapperel.style.transform = 'translate3d(0, 0, 0)';
		_viewwrapperel.style.opacity = '1';
		_viewwrapperel.style.transformOrigin = '';
	}
	if (_viewheaderel) {
		_viewheaderel.style.transform = 'translate3d(0, 0, 0)';
		_viewheaderel.style.opacity = '1';
		_viewheaderel.style.transformOrigin = '';
		_viewheaderel.style.filter = '';
	}

	content_animation.cancel();
	viewwrapperel_animation?.cancel();
	viewheaderel_animation?.cancel();

	componentel.isanimating = false;

	res()
})




const get_isanimating = (componentel:ComponentElT) =>  {
	return componentel.isanimating;
}


export const Ol2Animate = {
	init: init_animation_state,
	run_handle_scroll,
	animate_in,
	animate_out,
	get_isanimating
}




function set_theme_and_body_color_from_progress(progress: number) {
	const color_val = Math.round(_current_componentel.animation_theme_state.start_color + _current_componentel.animation_theme_state.color_range * progress);
	const color_str = `rgb(${color_val},${color_val},${color_val})`;

	_theme_color_meta.setAttribute("content", color_str);
	document.body.style.backgroundColor = color_str;
}



function set_viewwrapperel_from_progress(progress: number) {
	const scale = 1 - VIEWWRAPPEREL_SCALE_DIFF * progress;
	const translateY = 20 * progress;
	const opacity = 1 - VIEWWRAPPEREL_OPACITY_DIFF * progress;

	_viewwrapperel.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
	_viewwrapperel.style.opacity = opacity.toString();

	_viewheaderel.style.transform = `translate3d(0, ${translateY}px, 0)`;
	_viewheaderel.style.opacity = opacity.toString();
	_viewheaderel.style.filter = `blur(${VIEWHEADEREL_BLUR * progress}px)`;
}



// function animate_theme_and_body_color(duration: number, is_out: bool = false) {
// 	_current_componentel.animation_theme_state.duration = duration;
// 	_current_componentel.animation_theme_state.start_time = null;
//
//     _current_componentel.animation_theme_state.start_color = is_out ? 155 : 255;
//     const end_color = is_out ? 255 : 155;
//     _current_componentel.animation_theme_state.color_range = end_color - _current_componentel.animation_theme_state.start_color;
//
//     requestAnimationFrame(animate_theme_and_body_color__frame);
// }





// function animate_theme_and_body_color__frame(current_time: number) {
// 	if (_current_componentel.animation_theme_state.start_time === null) {
// 		_current_componentel.animation_theme_state.start_time = current_time;
// 	}
// 	const elapsed = current_time - _current_componentel.animation_theme_state.start_time;
// 	const progress = Math.min(elapsed / _current_componentel.animation_theme_state.duration, 1);
//
// 	set_theme_and_body_color_from_progress(progress);
//
// 	if (progress < 1) {
// 		requestAnimationFrame(animate_theme_and_body_color__frame);
// 	}
// }




async function util_await_scrollheight(componentel:ComponentElT) {
	return new Promise<void>(resolve => {
		const check = () => { if (componentel.scrollHeight > 0) { resolve(); } else { requestAnimationFrame(check); } };
		requestAnimationFrame(check);
	});
}

