
import { render, html, css, svg, LitElement } from "lit"
import { unsafeHTML } from "lit/directives/unsafe-html.js";

//import {classMap} from 'lit/directives/class-map.js';
//import {styleMap} from 'lit/directives/style-map.js';
//import {Directive, directive} from 'lit/directive.js';
//import {noChange} from 'lit';




(window as any).render        = render;
(window as any).html          = html;
(window as any).Lit_Element       = LitElement;
(window as any).Lit_UnsafeHtml    = unsafeHTML;
(window as any).Lit_Css           = css;

//(window as any).Lit_ClassMap = classMap;
//(window as any).Lit_StyleMap = styleMap;
//(window as any).Lit_Directive = Directive;
//(window as any).Lit_directive = directive;
//(window as any).Lit_noChange = noChange;
