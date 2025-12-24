// iOS Native Swipe-Back Gesture Handler

interface SwipeState {
	is_ios_safari: boolean;
	is_native_swipe: boolean;
	swipe_start_x: number;
	swipe_start_time: number;
	touch_identifier: number | null;
}

const EDGE_ZONE = 20; // iOS typically triggers from left 20px
const SWIPE_VELOCITY_THRESHOLD = 0.3; // px/ms
const MIN_SWIPE_DISTANCE = 50; // minimum distance to consider it a swipe

class BackSwipeHandler {
	private swipe_state: SwipeState;
	private prepare_view_callback: (() => void) | null = null;
	private is_native_swipe_callback: (() => boolean) | null = null;

	constructor() {
		// Detect iOS Safari
		const is_ios = /iPhone|iPad/.test(navigator.userAgent);
		const is_safari = /Safari/.test(navigator.userAgent);
		const is_not_chrome = !/Chrome|CriOS/.test(navigator.userAgent);
		
		this.swipe_state = {
			is_ios_safari: is_ios && is_safari && is_not_chrome,
			is_native_swipe: false,
			swipe_start_x: 0,
			swipe_start_time: 0,
			touch_identifier: null
		};

		if (this.swipe_state.is_ios_safari) {
			this.init_listeners();
		}
	}

	private init_listeners() {
		// Track touch start in edge zone
		window.addEventListener('touchstart', (e) => {
			const touch = e.touches[0];
			if (touch.clientX < EDGE_ZONE) {
				this.swipe_state.swipe_start_x = touch.clientX;
				this.swipe_state.swipe_start_time = Date.now();
				this.swipe_state.touch_identifier = touch.identifier;
				this.swipe_state.is_native_swipe = true; // Assume native swipe until proven otherwise
				this.prepare_views_for_native_swipe();
			}
		}, { passive: true });

		// Track touch move to validate swipe
		window.addEventListener('touchmove', (e) => {
			if (!this.swipe_state.is_native_swipe || this.swipe_state.touch_identifier === null) return;

			const touch = Array.from(e.touches).find(t => t.identifier === this.swipe_state.touch_identifier);
			if (!touch) return;

			const delta_x = touch.clientX - this.swipe_state.swipe_start_x;
			const delta_time = Date.now() - this.swipe_state.swipe_start_time;
			
			// Check if this is a rightward swipe with sufficient velocity
			if (delta_x > MIN_SWIPE_DISTANCE && delta_time > 0) {
				const velocity = delta_x / delta_time;
				if (velocity > SWIPE_VELOCITY_THRESHOLD) {
					// This is likely a native back swipe
					this.prepare_views_for_native_swipe();
				}
			} else if (delta_x < -10) {
				// Swiping left, not a back gesture
				this.swipe_state.is_native_swipe = false;
			}
		}, { passive: true });


		// Reset on touch end
		window.addEventListener('touchend', (e) => {
			if (this.swipe_state.touch_identifier === null) return;

			const ended_touch = Array.from(e.changedTouches).find(
				t => t.identifier === this.swipe_state.touch_identifier
			);
			
			if (ended_touch) {
				const delta_x = ended_touch.clientX - this.swipe_state.swipe_start_x;
				const delta_time = Date.now() - this.swipe_state.swipe_start_time;
				
				// If swipe wasn't completed (not enough distance/velocity), reset
				if (delta_x < MIN_SWIPE_DISTANCE || (delta_time > 0 && delta_x / delta_time < SWIPE_VELOCITY_THRESHOLD)) {
					this.swipe_state.is_native_swipe = false;
				}
				
				this.swipe_state.touch_identifier = null;
			}
		}, { passive: true });

		// Also reset on touch cancel
		window.addEventListener('touchcancel', () => {
			this.swipe_state.is_native_swipe = false;
			this.swipe_state.touch_identifier = null;
		}, { passive: true });
	}

	private prepare_views_for_native_swipe() {
		if (this.prepare_view_callback) {
			this.prepare_view_callback();
		}
	}

	public on_prepare_view(callback: () => void) {
		this.prepare_view_callback = callback;
	}

	public was_native_swipe(): boolean {
		const was_swipe = this.swipe_state.is_native_swipe;
		// Reset after checking
		this.swipe_state.is_native_swipe = false;
		return was_swipe;
	}

	public is_ios_safari(): boolean {
		return this.swipe_state.is_ios_safari;
	}
}

// Export singleton instance
export const back_swipe_handler = new BackSwipeHandler();
