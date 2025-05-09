import { bool } from '../../../defs_server_symlink.js'
import { CMechLoadedDataT, CMechLoadStateE, $NT, GenericRowT, LoggerSubjectE, LoggerTypeE } from "../../../defs.js"




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
        errorMessage: ""
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

		const emailInput    = this.shadow.getElementById('email')    as any;
		const passwordInput = this.shadow.getElementById('password') as any;
		
		emailInput.addEventListener(   'input', (e: any) => this.s.email    = e.target.value)
		passwordInput.addEventListener('input', (e: any) => this.s.password = e.target.value)
    }




	async attributeChangedCallback(name:string, oldval:string|boolean|number, newval:string|boolean|number) {
		$N.CMech.AttributeChangedCallback(this,name,oldval,newval);
	}




	disconnectedCallback() {   $N.CMech.ViewDisconnectedCallback(this);   }




	kd(_loadeddata: CMechLoadedDataT, loadstate:CMechLoadStateE, _pathparams:GenericRowT, searchparams:GenericRowT) {
		if (loadstate === CMechLoadStateE.INITIAL || loadstate === CMechLoadStateE.SEARCHCHANGED) {
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




    async Login() {
        if (!this.validateForm()) {
            return;
        }

        this.s.isLoading = true;
        this.s.errorMessage = "";
        this.sc();

        try {
            const r = await $N.FetchLassie('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: this.s.email,
                    password: this.s.password
                })
            });

            if (r.ok) {
                const data = r.data as any;
                localStorage.setItem("id_token", data.id_token);
                localStorage.setItem("token_expires_at", Math.floor(Date.now()/1000 + data.expires_in).toString());
                localStorage.setItem("refresh_token", data.refresh_token);
                localStorage.setItem("user_email", this.s.email);
                
                $N.Logger.Log(LoggerTypeE.info, LoggerSubjectE.engagement_pageview, "User logged in: " + this.s.email);
                
                // Navigate to home or redirect URL
                const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || 'home';
                $N.SwitchStation.NavigateTo(redirectUrl);
            } else {
                // Handle error response
                let errorMessage = "Login failed. Please try again.";
                if (r.data && typeof r.data === 'object' && (r.data as any).error) {
                    errorMessage = (r.data as any).error;
                }
                
                this.s.errorMessage = errorMessage;
                this.s.isLoading = false;
                this.sc();
                
                // Log error
                $N.Logger.Log(LoggerTypeE.error, LoggerSubjectE.switch_station_route_load_fail, "Login failed: " + errorMessage);
            }
        } catch (error) {
            this.s.errorMessage = "Network error. Please try again.";
            this.s.isLoading = false;
            this.sc();
            
            // Log error
            $N.Logger.Log(LoggerTypeE.error, LoggerSubjectE.switch_station_route_load_fail, "Login error: " + (error as Error).message);
        }
    }
    
    validateForm(): boolean {
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


    template = (_s:StateT) => { return html`{--css--}` }; 

}




customElements.define('v-login', VLogin);




export {  }
