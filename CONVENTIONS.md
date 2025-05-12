## Coding Style
- always use snake_case names for variables and function names, even in typescript and javascript
- Use the Early Exit and Return Early patterns 
- Use Guard Clauses conditional where needed  
- Keep the function code as flat as possible, minimizing indented logic wherever possible 
- when using try catch blocks, keep on single lines where possible. example:
    - try   { somevar = await some_promise(); }
    - catch { rej(); return; }
- use awaits where possible, vs promise chaining. 

## Web Components
- All Web Components are Vanilla -- no use of libraries like React.
- All DOM rendering is done by litHTML, so make sure to adhere to litHTML best practises.
- All Web Components are contained within a single directory, which has 3 files: ts, html and css, All three are bundled as one in build process. Always put string literal html content within the html file.   
