declare global { interface Window { render: any; html: any; } }

if (!(window as any).render) {
    (window as any).render = (_tmpl: any, shadow: ShadowRoot) => {
        if (!shadow) return;
        shadow.innerHTML = '<div id="msg"></div>';
    };
}
if (!(window as any).html) {
    (window as any).html = (_s: TemplateStringsArray, ..._v: any[]) => '';
}
