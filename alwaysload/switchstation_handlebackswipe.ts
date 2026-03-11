

const EDGE_ZONE                = 20; // iOS typically triggers from left 20px
const SWIPE_VELOCITY_THRESHOLD = 0.3; // px/ms
const MIN_SWIPE_DISTANCE       = 50; // minimum distance to consider it a swipe



let _swipe_start_x    = -1;
let _swipe_start_time = 0;
let _is_native_swipe  = false;
let _was_native_swipe_triggered = false;




export function WasNativeSwipe() {
	return _is_native_swipe;
}




export function HandleBackSwipeInitListeners(
	backswipe_detected_callback:()=>void
) {

	window.addEventListener('touchstart', (e) => {

		_is_native_swipe = false;
		_was_native_swipe_triggered = false;
		_swipe_start_time = 0;

		if (e.touches[0].clientX < EDGE_ZONE) {
			_swipe_start_x = e.touches[0].clientX;
			_swipe_start_time = Date.now();
		}
	}, { passive: true });


	window.addEventListener('touchmove', (e) => {
		if (_swipe_start_time === 0 || _was_native_swipe_triggered) return;

		const touch      = e.touches[0]

		const delta_x    = touch.clientX - _swipe_start_x;
		const delta_time = Date.now() - _swipe_start_time;

		_is_native_swipe = false;
		
		if (delta_x > MIN_SWIPE_DISTANCE && delta_time > 0) {
			const velocity = delta_x / delta_time;
			if (velocity > SWIPE_VELOCITY_THRESHOLD) {
				_is_native_swipe = true;
				_was_native_swipe_triggered = true;
			}
		} 
	}, { passive: true });

	window.addEventListener('touchend', () => {
		if (_is_native_swipe && _was_native_swipe_triggered) {
			backswipe_detected_callback();
		}
	}, { passive: true });

	window.addEventListener('touchcancel', () => {
		_is_native_swipe = false;
	}, { passive: true });
}

