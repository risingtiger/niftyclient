# Guidelines

## Build/Test Commands
- Build: `build alldev`

## Coding Style Guidelines
- always use snake_case names for variables and function names, even in typescript and javascript
- Use the Early Exit and Return Early patterns 
- Use Guard Clauses conditional where needed  
- Keep the function code as flat as possible, minimizing indented logic wherever possible 
- when using try catch blocks, keep on single lines where possible. example:
    - try   { somevar = await some_promise(); }
    - catch { rej(); return; }
- use awaits where possible, vs promise chaining. 




## Web Components
- All Web Components are VanillaJS -- no use of libraries like React, but instead simply extends HTMLElement
- All DOM rendering is done by litHTML, so make sure to adhere to litHTML best practises.
- All App Views and App Components are contained within a single directory, which has 3 files: ts, html and css, though all three are bundled as one js file in build process. 
    - Always put string literal html content (for litHTML rendering) within the html file.   
    - views and components are contained within lazy/views and lazy/components respectively, e.g. ./lazy/views/example_view and ./lazy/components/example_component. Example of a view files are: ./lazy/views/example_view/[example_view.ts, example_view.html, example_view.css]. App components are similar, but in ./lazy/components folder instead.

## View Components Specifications
- Each view corresponds to a url in the browser, e.g. http://example.com/v/home 
- Each view is simply a Web Component
- Each view contains an AttributeT, ModelT, and StateT for: attributes on view html element in dom; data from server that is immutable without updating first on server; and state data which is mutable local state to the view
- Each View must call a framework utilty called ViewConnectedCallback which sets up baseline functionality 
    - ViewConnectedCallback automatically handles initial data load and render
- Each View must dispatchEvent 'hydrated' to specify that the DOM is hydrated and rendered and ready to be displayed
- Each View must contain an sc function (short for statechanged). It renders (via litHTML) the model and state to the DOM
- Each View must contain a kd function. This function is called when data is loaded or updated from the server. It is responsible for morphing the server data into usable data for local model and state properties.

