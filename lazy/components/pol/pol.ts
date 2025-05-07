
import { str, num, bool, } from '../../../defs_server_symlink.js';

declare var render: any;
declare var html: any;

enum ShapeE {
	NOT_APPLICABLE,
	PRIORITY_MOBILE_FULL,
	PRIORITY_MOBILE_BOTTOM_HALF,
	PRIORITY_MOBILE_BOTTOM_THIRD,
	PRIORITY_DESKTOP_MD,
	PRIORITY_DESKTOP_LG,
	PRIORITY_DESKTOP_XL,
	PRIORITY_DESKTOP_XXL,
	XS,
};

type StateT = {
	title: str,
	width: str,
	height: str,
	top: str,
	left: str,
	marginLeft: str,
	shape: ShapeE,
	showHeader: bool,
	isMinimizable: bool,
	isMinimized: bool,
	isMobileCentric: bool,
};

type ModelT = {
	prop: num,
};

const DESKTOP_DEFAULT_WIDTH: num = 480;
const DESKTOP_TO_MOBILE_DOWNSIZE_WIDTH: num = 390;
const DESKTOP_DEFAULT_HEIGHT: num = 800;
const DESKTOP_DEFAULT_TOP: num = 34;

const MOBILE_DEFAULT_HALF_HEIGHT: num = 400;
const MOBILE_DEFAULT_THIRD_HEIGHT: num = 200;

const WINDOW_HEIGHT_PRIORITY_MOBILE_FULL: num = 0;
const WINDOW_WIDTH_PRIORITY_MOBILE_FULL: num = 0;
const WINDOW_HEIGHT_PRIORITY_MOBILE_BOTTOM_HALF: num = MOBILE_DEFAULT_HALF_HEIGHT;
const WINDOW_WIDTH_PRIORITY_MOBILE_BOTTOM_HALF: num = 0;
const WINDOW_HEIGHT_PRIORITY_MOBILE_BOTTOM_THIRD: num = MOBILE_DEFAULT_THIRD_HEIGHT;
const WINDOW_WIDTH_PRIORITY_MOBILE_BOTTOM_THIRD: num = 0;
const WINDOW_HEIGHT_PRIORITY_DESKTOP_MD: num = DESKTOP_DEFAULT_HEIGHT;
const WINDOW_WIDTH_PRIORITY_DESKTOP_MD: num = DESKTOP_DEFAULT_WIDTH;
const WINDOW_HEIGHT_PRIORITY_DESKTOP_LG: num = 1000;
const WINDOW_WIDTH_PRIORITY_DESKTOP_LG: num = 640;
const WINDOW_HEIGHT_PRIORITY_DESKTOP_XL: num = 1200;
const WINDOW_WIDTH_PRIORITY_DESKTOP_XL: num = 800;
const WINDOW_HEIGHT_PRIORITY_DESKTOP_XXL: num = 1400;
const WINDOW_WIDTH_PRIORITY_DESKTOP_XXL: num = 1024;
const WINDOW_HEIGHT_XS: num = 350;
const WINDOW_WIDTH_XS: num = 280;

class CPOl extends HTMLElement {
	state: StateT;
	model: ModelT;

	$: any;

	wrapperAnimation!: Animation|null;
	slotAnimation!: Animation|null;
	sheet: CSSStyleSheet;
	shadow: ShadowRoot;

	constructor() {
		super();

		this.state = {
			title: '',
			width: '',
			height: '',
			top: '',
			left: '',
			marginLeft: '',
			shape: ShapeE.PRIORITY_MOBILE_FULL,
			showHeader: true,
			isMinimizable: true,
			isMinimized: false,
			isMobileCentric: false,
		};

		this.$ = this.querySelector;

		this.shadow = this.attachShadow({mode: 'open'});
	}

	connectedCallback() {
		this.state.title = this.getAttribute('title') || '';
		this.state.isMinimizable = this.getAttributeAsBoolean('minimizable', true);
		this.state.showHeader = this.getAttributeAsBoolean('showHeader', true);

		const child = this.firstElementChild as HTMLElement;

		child.addEventListener('toggleCollapseExpand', () => {
			this.toggleCollapseExpand();
		});

		this.stateChange();

		if (child.tagName.startsWith('C-') || child.tagName.startsWith('VP-')) {
			child.addEventListener('hydrated', () => { this.onOpen() });
		} else {
			this.onOpen();
		}
	}

	disconnectedCallback() {
	}

	static get observedAttributes() {
		return [
			'minimize',
		];
	}

	private toggleCollapseExpand() {
		if (this.state.isMinimized) {
			this.slotAnimation!.reverse();
		} else {
			this.slotAnimation!.playbackRate = 1;
			this.slotAnimation!.currentTime = 0;
			this.slotAnimation!.play();
		}
	}

	private onCollapsed() {
		//
	}

	private onExpanded() {
		//
	}

	private getAttributeAsBoolean(name: str, def: bool|true) {
		let value = this.getAttribute(name) || def;

		if (typeof value === 'boolean') {
			return value;
		}

		value = String(value).trim().toLowerCase();

		if (['1', 'true', 'yes'].includes(value)) {
			return true;
		}

		if (['0', 'false', 'no'].includes(value)) {
			return false;
		}

		return def;
	}

	private onOpen() {
		this.setupWindow();
		this.setupDom();
		this.setupAnimation();

		this.wrapperAnimation!.addEventListener('finish', () => { this.onOpenAnimateFinished(); });

		this.slotAnimation!.addEventListener('finish', () => {
			this.state.isMinimized = !this.state.isMinimized;

			if (this.state.isMinimized) {
				this.onCollapsed();
			} else {
				this.onExpanded();
			}

			this.stateChange();
		});

		this.stateChange();
		this.setAttribute('opening', 'true');
		this.animateShow();
	}

	private onOpenAnimateFinished() {
		if (this.wrapperAnimation!.playbackRate === -1) {
			this.removeAttribute('collapsing');
			this.removeAttribute('opened');
			this.setAttribute('collapsed', 'true');
			this.dispatchEvent(new Event('collapsed'));

			return;
		}

		this.removeAttribute('opening');
		this.removeAttribute('collapsed');
		this.setAttribute('opened', 'true');
	}

	private setupWindow() {
		const WINDOW_INNER_WIDTH = window.innerWidth;
		const TOP = Number(this.getAttribute('top') || 0);
		const LEFT = Number(this.getAttribute('left') || 0);

		const WINDOW_DIMENSION = this.getSetupWindowDimension();

		if (WINDOW_DIMENSION.width) {
			this.state.left = LEFT
				? `${LEFT}px`
				: '50%';

				this.state.marginLeft = `-${WINDOW_DIMENSION.width / 2}px`;

				this.state.width = `${WINDOW_DIMENSION.width}px`;
		} else {
			this.state.left = '0';
			this.state.width = '100%';
		}

		if (WINDOW_DIMENSION.height) {
			this.state.height = `${WINDOW_DIMENSION.height}px`;

			this.state.top = TOP
				? `${TOP}px`
				: `${DESKTOP_DEFAULT_TOP}px`;
		} else {
			this.state.height = '100%';
			this.state.top = '0';
		}

		this.state.isMobileCentric = WINDOW_INNER_WIDTH < DESKTOP_DEFAULT_WIDTH;
	}

	private getSetupWindowDimension(): { height: num, width: num } {
		const WINDOW_INNER_WIDTH = window.innerWidth;
		const SHAPE = Number(this.getAttribute('shape') || 0) || ShapeE.PRIORITY_MOBILE_FULL;
		const WIDTH = this.getAttribute('width') || 0;
		const HEIGHT = this.getAttribute('height') || 0;

		if (Number(WIDTH) > 0) {
			if (WINDOW_INNER_WIDTH < DESKTOP_DEFAULT_WIDTH) {
				return {
					height: 0,
					width: 0,
				};
			}

			return {
				height: Number(HEIGHT) || DESKTOP_DEFAULT_HEIGHT,
				width: Number(WIDTH),
			};
		}

		if ([ShapeE.PRIORITY_MOBILE_FULL, ShapeE.PRIORITY_MOBILE_BOTTOM_HALF, ShapeE.PRIORITY_MOBILE_BOTTOM_THIRD].includes(SHAPE)) {
			if (WINDOW_INNER_WIDTH >= DESKTOP_DEFAULT_WIDTH) {
				return {
					height: DESKTOP_DEFAULT_HEIGHT,
					width: DESKTOP_TO_MOBILE_DOWNSIZE_WIDTH,
				};
			}

			switch (SHAPE) {
				case ShapeE.PRIORITY_MOBILE_FULL:
					return {
						height: WINDOW_HEIGHT_PRIORITY_MOBILE_FULL,
						width: WINDOW_WIDTH_PRIORITY_MOBILE_FULL,
					};

				case ShapeE.PRIORITY_MOBILE_BOTTOM_HALF:
					return {
						height: WINDOW_HEIGHT_PRIORITY_MOBILE_BOTTOM_HALF,
						width: WINDOW_WIDTH_PRIORITY_MOBILE_BOTTOM_HALF,
					};

				case ShapeE.PRIORITY_MOBILE_BOTTOM_THIRD:
					return {
						height: WINDOW_HEIGHT_PRIORITY_MOBILE_BOTTOM_THIRD,
						width: WINDOW_WIDTH_PRIORITY_MOBILE_BOTTOM_THIRD,
					};
			}
		}

		if ([ShapeE.PRIORITY_DESKTOP_MD, ShapeE.PRIORITY_DESKTOP_LG, ShapeE.PRIORITY_DESKTOP_XL, ShapeE.PRIORITY_DESKTOP_XXL].includes(SHAPE)) {
			if (WINDOW_INNER_WIDTH < DESKTOP_DEFAULT_WIDTH) {
				return {
					height: 0,
					width: 0,
				};
			}

			switch (SHAPE) {
				case ShapeE.PRIORITY_DESKTOP_MD:
					return {
						height: WINDOW_HEIGHT_PRIORITY_DESKTOP_MD,
						width: WINDOW_WIDTH_PRIORITY_DESKTOP_MD,
					};

				case ShapeE.PRIORITY_DESKTOP_LG:
					return {
						height: WINDOW_HEIGHT_PRIORITY_DESKTOP_LG,
						width: WINDOW_WIDTH_PRIORITY_DESKTOP_LG,
					};

				case ShapeE.PRIORITY_DESKTOP_XL:
					return {
						height: WINDOW_HEIGHT_PRIORITY_DESKTOP_XL,
						width: WINDOW_WIDTH_PRIORITY_DESKTOP_XL,
					};

				case ShapeE.PRIORITY_DESKTOP_XXL:
					return {
						height: WINDOW_HEIGHT_PRIORITY_DESKTOP_XXL,
						width: WINDOW_WIDTH_PRIORITY_DESKTOP_XXL,
					};

			}
		}

		if (SHAPE === ShapeE.XS) {
			return {
				height: WINDOW_HEIGHT_XS,
				width: WINDOW_WIDTH_XS,
			};
		}

		return {
			height: 0,
			width: 0,
		};
	}

	private setupDom() {
		const wrapper = this.shadow.querySelector('.wrapper') as HTMLElement;

		wrapper.style.bottom = '0';
		wrapper.style.display = 'block grid';
		wrapper.style.gridTemplateRows = 'auto 1fr';
		wrapper.style.marginLeft = this.state.marginLeft;
		wrapper.style.maxHeight = this.state.height;
		wrapper.style.right = '0';
		wrapper.style.width = this.state.width;

		if (this.state.isMobileCentric) {
			wrapper.classList.add('mobile_centric');
		}
	}

	private setupAnimation() {
		const WRAPPER  = this.shadow.querySelector('.wrapper')! as HTMLElement;
		const SLOT = WRAPPER.querySelector('header + *')! as HTMLElement;
		const ANIMATIONS = this.getSetupAnimationAnimations();
		const TIMINGS = this.getSetupAnimationTimings();
		const ENV = this.state.isMobileCentric
			? 'mobile'
			: 'desktop';

		this.wrapperAnimation = WRAPPER.animate(
			ANIMATIONS.get(`${ENV}_wrapper_fade_up`)!,
			TIMINGS.get('mobile_a') as any
		);
		this.wrapperAnimation.pause();

		this.slotAnimation = SLOT.animate(
			ANIMATIONS.get(`${ENV}_slot_collapse`)!,
			TIMINGS.get('mobile_a') as any
		);
		this.slotAnimation.pause();
	}

	private getSetupAnimationAnimations() {
		const ANIMATIONS = new Map<str, Array<any>>()

		ANIMATIONS.set('mobile_wrapper_fade_up', [
			{opacity: '0', transform: `translateY(${this.state.height})`},
			{opacity: '1', transform: 'translateY(0)'},
		]);

		ANIMATIONS.set('desktop_wrapper_fade_up', [
			{opacity: '0', transform: `translateY(${this.state.height})`},
			{opacity: '1', transform: 'translateY(0)'},
		]);

		// While it is easier/straightforward to implement this in CSS,
		// unfortunately animation does not work if `height`/`max-height` is set to `auto`.
		// Since we can not dynamically set the value in the CSS file, we'll set the animation here.
		ANIMATIONS.set('desktop_slot_collapse', [
			{ maxHeight: `${this.state.height}` },
			{ maxHeight: '0' },
		]);

		// While it is easier/straightforward to implement this in CSS,
		// unfortunately animation does not work if `height`/`max-height` is set to `auto`.
		// Since we can not dynamically set the value in the CSS file, we'll set the animation here.
		ANIMATIONS.set('desktop_slot_expand', [
			{ maxHeight: '0' },
			{ maxHeight: `${this.state.height}` },
		]);

		return ANIMATIONS;
	}

	private getSetupAnimationTimings() {
		const TIMINGS = new Map<str, any>()

		TIMINGS.set('mobile_a', {
			duration: 500,
			easing: 'cubic-bezier(0.69, 0, 0.29, 1)',
			fill: 'both',
			iterations: 1,
		});

		TIMINGS.set('dekstop_a', {
			duration: 1000,
			easing: 'cubic-bezier(0.69, 0, 0.29, 1)',
			fill: 'both',
			iterations: 1,
		});

		return TIMINGS;
	}

	private animateShow() {
		this.wrapperAnimation!.playbackRate = 1;
		this.wrapperAnimation!.currentTime = 0;
		this.wrapperAnimation!.play();
	}

	private stateChange() {
		render(this.template(this.state, this.model), this.shadow);
	}

	private template (_state: StateT, _model: ModelT) {
		return html`{--css--}{--html--}`;
	}
}

customElements.define('c-pol', CPOl);

export {}
