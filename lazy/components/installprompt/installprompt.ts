

import { $NT, InstallStatusT } from "../../../defs.js";

declare var render: any;
declare var html: any;
declare var $N: $NT;




class CInstallPrompt extends HTMLElement {

	shadow: ShadowRoot




	constructor() {

		super();

		this.shadow = this.attachShadow({ mode: 'open' });
	}




	connectedCallback() {

		this.sc();

		this.shadow.getElementById('installbtn')!.addEventListener('click', () => this.install_clicked());
		this.shadow.getElementById('ios_close')!.addEventListener('click', () => this.toggle_ios_overlay(false));

		document.addEventListener('installavailable', this.refresh);
		window.addEventListener('appinstalled', this.refresh);

		this.refresh();
	}




	disconnectedCallback() {

		document.removeEventListener('installavailable', this.refresh);
		window.removeEventListener('appinstalled', this.refresh);
	}




	refresh = () => {

		const status: InstallStatusT = $N.Install.GetStatus();

		const wrapper = this.shadow.getElementById('wrapper')!;

		if (status === 'available' || status === 'ios_manual') {
			wrapper.classList.remove('hidden');
		} else {
			wrapper.classList.add('hidden');
			this.toggle_ios_overlay(false);
		}
	}




	async install_clicked() {

		const status: InstallStatusT = $N.Install.GetStatus();

		if (status === 'available') {
			await $N.Install.Prompt();
			this.refresh();
			return;
		}

		if (status === 'ios_manual') {
			this.toggle_ios_overlay(true);
		}
	}




	toggle_ios_overlay(show: boolean) {

		const overlay = this.shadow.getElementById('ios_overlay')!;

		if (show) overlay.classList.remove('hidden');
		else      overlay.classList.add('hidden');
	}




	sc() {   render(this.template(), this.shadow);   }




	template = () => { return html`{--css--}{--html--}`; };
}




customElements.define('c-installprompt', CInstallPrompt);




export { }
