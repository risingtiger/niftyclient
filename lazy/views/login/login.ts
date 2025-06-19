import { bool } from '../../../defs_server_symlink.js'
import { CMechLoadedDataT, $NT, GenericRowT } from "../../../defs.js"




declare var render: any;
declare var html: any;
declare var $N: $NT;



type AttributesT = {
    propa: string,
}

type ModelT = {
	propa: string,
}
type StateT = {
    propa: bool,
    email: string,
    password: string,
    isLoading: boolean,
    errorMessage: string
	resetlink: string
}




const ATTRIBUTES:AttributesT = { propa: "" }




class VLogin extends HTMLElement {

	m:ModelT = { propa: "" };
	a:AttributesT = { ...ATTRIBUTES };
    s:StateT = {
		propa: false,
        email: "",
        password: "",
        isLoading: false,
        errorMessage: "",
		resetlink: ""
	}

    shadow:ShadowRoot




	static get observedAttributes() { return Object.keys(ATTRIBUTES); }




    constructor() {   

        super(); 
        this.shadow = this.attachShadow({mode: 'open'});
    }




    async connectedCallback() {   
		await $N.CMech.ViewConnectedCallback(this)
		this.dispatchEvent(new Event('hydrated'));

		const emailInput    = this.shadow.getElementById('emailinput')    as any;
		const passwordInput = this.shadow.getElementById('passwordinput') as any;
		
		emailInput.addEventListener(   'input', (e: any) => this.s.email    = e.target.value)
		passwordInput.addEventListener('input', (e: any) => this.s.password = e.target.value)
    }




	async attributeChangedCallback(name:string, oldval:string|boolean|number, newval:string|boolean|number) {
		$N.CMech.AttributeChangedCallback(this,name,oldval,newval);
	}




	disconnectedCallback() {   $N.CMech.ViewDisconnectedCallback(this);   }




	kd(_loadeddata: CMechLoadedDataT, loadstate:string, _pathparams:GenericRowT, searchparams:GenericRowT) {
		if (loadstate === 'initial' || loadstate === 'searchchanged') {
            // Check for error parameter in URL
            if (searchparams.error) {
                this.s.errorMessage = decodeURIComponent(searchparams.error as string);
            }
            
            // Restore email from URL params if available
            if (searchparams.email) {
                this.s.email = decodeURIComponent(searchparams.email as string);
            }
            
            this.sc();
		}
	}




    sc() {
        render(this.template(this.s), this.shadow);
    }




    async login() {

        this.s.isLoading = true;
        this.s.errorMessage = "";
        this.sc();

		const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=` + localStorage.getItem("identity_platform_key");


		const email = this.s.email;
		const password = this.s.password;

        if (!this.validateForm()) {
            this.s.isLoading = false;
            return;
        }

		const body = { email, password, returnSecureToken: true };

		const opts = {
			method: 'POST',
			body: JSON.stringify(body),
			headers: {
				'Content-Type': 'application/json'
			}
		}

		try {
			const response = await fetch(url, opts);
			const data = await response.json();
			
			if (!response.ok) {
				this.s.isLoading = false;
				this.s.errorMessage = "Login failed. Please check your credentials and try again.";
				this.sc();
				return;
			}
		
			localStorage.setItem('id_token', data.idToken);
			localStorage.setItem('token_expires_at',  ( (Math.floor(Date.now()/1000)) + Number(data.expiresIn) ).toString() ),
			localStorage.setItem('refresh_token', data.refreshToken);
			localStorage.setItem('user_email', data.email);

			if (data.email === "accounts@risingtiger.com")
				localStorage.setItem('auth_group', 'admin');
			else 
				localStorage.setItem('auth_group', 'user');

			window.location.href = "/v/home";

		} catch (error) {
			this.s.isLoading = false;
			this.s.errorMessage = "Login failed. Please try again.";
			this.sc();
		}
    }
    
    validateForm() {
        // Simple validation
        if (!this.s.email || !this.s.email.includes('@')) {
            this.s.errorMessage = "Please enter a valid email address";
            this.sc();
            return false;
        }

        if (!this.s.password || this.s.password.length < 6) {
            this.s.errorMessage = "Password must be at least 6 characters";
            this.sc();
            return false;
        }

        return true;
    }




    async ResetPassword() {
        if (!this.s.email || !this.s.email.includes('@')) {
            this.s.errorMessage = "Please enter your email address to reset your password";
            this.sc();
            return;
        }

        this.s.isLoading = true;
        this.s.errorMessage = "";
        this.sc();

		const r = await $N.FetchLassie(`/api/reset_password?email=${this.s.email}`);

		this.s.isLoading = false;

		if (!r.ok)  {
			// Handle error response
			let errorMessage = "Password reset failed. Please try again.";
			if (r.data && typeof r.data === 'object' && (r.data as any).error) {
				errorMessage = (r.data as any).error;
			}

			this.s.errorMessage = errorMessage;
			this.sc();
			return
		}


		this.s.errorMessage = "";
		this.s.password = "";
		this.s.resetlink = ( r.data as any ).link

		this.sc()
    }


	template = (_s:any) => { return html`{--css--}{--html--}`; };

}




customElements.define('v-login', VLogin);




export {  }
