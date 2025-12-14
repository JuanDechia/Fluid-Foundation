import React, { useEffect, useRef } from 'react';

interface SandboxedRendererProps {
  code: string; // The React component code (string)
  data: any;    // The data to pass as props
}

const SandboxedRenderer: React.FC<SandboxedRendererProps> = ({ code, data }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fix common LLM syntax errors before data injection
  const cleanCode = (c: string) => {
    // Fix: .split('
    // ') -> .split('\n')
    return c.replace(/\.split\(\s*(['"])\r?\n\s*\1\s*\)/g, ".split($1\\n$1)");
  };

  useEffect(() => {
    if (!iframeRef.current) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    // Use esm.sh to load compatible React/ReactDOM/Lucide versions
    // We explicitly mount these in the module script to avoid React instance conflicts
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="https://cdn.tailwindcss.com"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          
          <script>
            // Error Capture Hook
            window.onerror = function(msg, url, line, col, error) {
              window.parent.postMessage({ 
                type: 'SANDBOX_ERROR', 
                payload: { message: msg, line, col } 
              }, '*');
            };

            const originalConsoleError = console.error;
            console.error = function(...args) {
              originalConsoleError.apply(console, args);
              // Simple serialization of args
              const message = args.map(a => 
                typeof a === 'object' ? JSON.stringify(a) : String(a)
              ).join(' ');
              
              window.parent.postMessage({ 
                type: 'SANDBOX_CONSOLE_ERROR', 
                payload: { message } 
              }, '*');
            };
          </script>
          
          <script type="importmap">
            {
              "imports": {
                "react": "https://esm.sh/react@18.2.0",
                "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
                "react-dom": "https://esm.sh/react-dom@18.2.0",
                "recharts": "https://esm.sh/recharts@2.12.0"
              }
            }
          </script>

          <style>
            body { background-color: #0f172a; color: white; margin: 0; padding: 0; font-family: sans-serif; height: 100vh; width: 100vw; overflow-y: auto; overflow-x: hidden; }
            #root { height: 100%; width: 100%; }
            /* Scrollbar styling */
            ::-webkit-scrollbar { width: 8px; height: 8px; }
            ::-webkit-scrollbar-track { background: #0f172a; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            ::-webkit-scrollbar-thumb:hover { background: #475569; }
            /* New/Modified Content Highlighting */
            @keyframes glow-pulse {
              0% { box-shadow: 0 0 5px rgba(56, 189, 248, 0), inset 0 0 0 rgba(56, 189, 248, 0); border-color: transparent; }
              10% { box-shadow: 0 0 15px rgba(56, 189, 248, 0.6), inset 0 0 10px rgba(56, 189, 248, 0.2); border-color: rgba(56, 189, 248, 0.8); }
              100% { box-shadow: 0 0 5px rgba(56, 189, 248, 0), inset 0 0 0 rgba(56, 189, 248, 0); border-color: transparent; }
            }
            .animate-glow {
              animation: glow-pulse 3s ease-out forwards;
              border: 1px solid transparent; 
              border-radius: 0.5rem; 
              transition: all 0.3s;
            }
          </style>
        </head>
        <body>
          <div id="root"></div>
          
          <script type="module">
            import React from 'https://esm.sh/react@18.2.0';
            import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
            import * as Lucide from 'https://esm.sh/lucide-react@0.344.0?external=react';
            import * as Recharts from 'https://esm.sh/recharts@2.12.0?external=react';

            const DATA_CONTEXT = ${JSON.stringify(data)};
            
            const RAW_CODE = \`${cleanCode(code).replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;

            // Shim for 'require' to allow idiomatic React code
            const require = (moduleName) => {
                if (moduleName === 'react') return React;
                if (moduleName === 'lucide-react') return Lucide;
                if (moduleName === 'recharts') return Recharts;
                throw new Error(\`Cannot find module '\${moduleName}'\`);
            };

            async function run() {
              try {
                // 1. Transpile the user's code
                // We use 'env' preset to transform imports to CommonJS (require quotes)
                const transpiled = Babel.transform(RAW_CODE, { 
                    presets: ['env', 'react'], 
                    filename: 'dynamic.js' 
                }).code;

                // 2. Create an execution scope
                // We construct a function that takes our dependencies 
                // We also shim 'exports' and 'module' since Babel 'env' preset expects them
                const funcBody = transpiled + "\\nreturn module.exports.default || exports.default || (typeof App !== 'undefined' ? App : null);";
                
                // Pass 'require', 'exports', 'module' to the function scope
                const componentFactory = new Function('React', 'require', 'Lucide', 'Recharts', 'exports', 'module', funcBody);
                
                const exports = {};
                const module = { exports };

                // 3. Execute to get component
                const App = componentFactory(React, require, Lucide, Recharts, exports, module);

                if (!App) {
                   throw new Error("Could not find 'App' component. Ensure you have 'export default App' or define 'const App'.");
                }

                // 4. Render
                const root = createRoot(document.getElementById('root'));
                root.render(React.createElement(App, { data: DATA_CONTEXT }));

              } catch (err) {
                console.error("Sandbox Runtime Error:", err);
                document.getElementById('root').innerHTML = \`
                  <div class="p-4 text-red-400 font-mono text-sm bg-red-900/20 border border-red-800 rounded">
                    <strong>Runtime Error:</strong><br/>
                    \${err.message}
                  </div>
                \`;
              }
            }

            run();
          </script>
        </body>
      </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();

  }, [code, data]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-none bg-slate-950"
      title="Fluid Canvas"
    />
  );
};

export default SandboxedRenderer;
