// The single source of truth for "what languages does pretty-lush support".
// Adding a new language touches this file plus formatters/index.js and
// languages/codemirror.js.

// LANGUAGES drives the sidebar menu and the ⌘K palette language pickers.
export const LANGUAGES = [
  { id: "python",     label: "Python",        ext: "py" },
  { id: "json",       label: "JSON",          ext: "json" },
  { id: "yaml",       label: "YAML",          ext: "yaml" },
  { id: "shell",      label: "Shell",         ext: "sh" },
  { id: "dockerfile", label: "Dockerfile",    ext: "" },
  { id: "javascript", label: "JavaScript",    ext: "js" },
  { id: "typescript", label: "TypeScript",    ext: "ts" },
  { id: "jsx",        label: "JSX (React)",   ext: "jsx" },
  { id: "tsx",        label: "TSX (React)",   ext: "tsx" },
  { id: "vue",        label: "Vue SFC",       ext: "vue" },
  { id: "html",       label: "HTML",          ext: "html" },
  { id: "css",        label: "CSS",           ext: "css" },
  { id: "markdown",   label: "Markdown",      ext: "md" },
  { id: "dotenv",     label: "Dotenv",        ext: "env" },
  { id: "sql",        label: "SQL",           ext: "sql" },
];

// Seed content shown when the user picks a language for the first time.
// Intentionally messy so the formatter has visible work to do.
export const SAMPLES = {
  python: `def greet(name,age=18):\n    return f"hi {name}, {age}"\nprint( greet("ada") )`,
  json: `[{"id":1,"name":"ada","role":"engineer","active":true},{"id":2,"name":"linus","role":"engineer","active":false},{"id":3,"name":"grace","role":"admiral","active":true}]`,
  yaml: `name: pretty-lush\nlangs:\n - py\n - json\nactive: true`,
  shell: `#!/usr/bin/env bash\nset -e\nfor f in *.py;do\necho "$f"\ndone`,
  dockerfile: `FROM python:3.11-slim\nWORKDIR  /app\nCOPY . .\nRUN pip install -r requirements.txt\nCMD ["python","app.py"]`,
  javascript: `const greet=(name,age=18)=>{\nreturn \`hi \${name}, \${age}\`\n}\nconsole.log(greet("ada"))`,
  typescript: `type User={name:string;age?:number}\nconst greet=(u:User)=>\`hi \${u.name}\`\nconsole.log(greet({name:"ada"}))`,
  jsx: `function Greeting({name,age=18}){\nreturn (<div className="card"><h1>hi {name}</h1><p>age: {age}</p></div>)\n}\nexport default Greeting`,
  tsx: `type Props={name:string;age?:number}\nexport default function Greeting({name,age=18}:Props){\nreturn (<div className="card"><h1>hi {name}</h1><p>age: {age}</p></div>)\n}`,
  vue: `<template>\n<div class="card"><h1>hi {{name}}</h1><p>age: {{age}}</p></div>\n</template>\n<script setup>\nimport { defineProps } from 'vue'\ndefineProps({name:String,age:{type:Number,default:18}})\n</script>\n<style scoped>\n.card{padding:12px;border:1px solid #ddd;border-radius:6px}\n</style>`,
  html: `<!doctype html><html><head><title>x</title></head><body><h1>hello</h1><p>world</p></body></html>`,
  css: `body{margin:0;font-family:system-ui}.btn{background:#1f6f4a;color:#fff;padding:8px 12px;border-radius:6px}`,
  markdown: `# pretty-lush\n\nA formatter for **JSON**,YAML,Python and more.\n\n- fast\n- private\n-  in your browser`,
  dotenv: `# pretty-lush sample env\nNODE_ENV =production\nPORT= 3000\nDATABASE_URL="postgres://user:pass@localhost:5432/db"\n  API_KEY=  sk_live_abc123\nFEATURE_FLAG=true`,
  sql: `select u.id, u.name, count(o.id) as order_count from users u left join orders o on o.user_id=u.id where u.active=true and u.created_at>='2024-01-01' group by u.id,u.name having count(o.id)>5 order by order_count desc limit 50;`,
};

// File extension → language id.
export const EXT_TO_LANG = {
  py: "python",
  pyw: "python",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  vue: "vue",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  md: "markdown",
  markdown: "markdown",
  dockerfile: "dockerfile",
  env: "dotenv",
  sql: "sql",
};

// Language id → fenced-code tag used by the "Copy as Markdown" action.
export const MARKDOWN_LANG_TAGS = {
  python: "python",
  json: "json",
  yaml: "yaml",
  shell: "bash",
  dockerfile: "dockerfile",
  javascript: "js",
  typescript: "ts",
  jsx: "jsx",
  tsx: "tsx",
  vue: "vue",
  html: "html",
  css: "css",
  markdown: "md",
  dotenv: "ini",
  sql: "sql",
};
