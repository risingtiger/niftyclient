## Coding Style
- always use snake_case names for variables and function names, even in typescript and javascript
- Use the Early Exit and Return Early patterns 
- Use Guard Clauses conditional where needed  
- Keep the function code as flat as possible, minimizing indented logic wherever possible 
- when using try catch blocks, keep on single lines where possible. example:
    - try   { somevar = await some_promise(); }
    - catch { rej(); return; }
- use awaits where possible, vs promise chaining. 

