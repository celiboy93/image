import { Hono } from "jsr:@hono/hono";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const app = new Hono();
const SERVER_API_KEY = Deno.env.get("THUMBSNAP_KEY") || "";

// 1. Frontend Interface
app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thumbsnap Uploader (Debug Mode)</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
    </head>
    <body class="bg-gray-900 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
            <h1 class="text-xl font-bold mb-6 text-center text-gray-800">
                <i class="fa-solid fa-cloud-arrow-up text-red-500"></i> Adult Uploader
            </h1>
            
            <form id="uploadForm" class="space-y-4">
                
                <!-- Adult Selection -->
                <div class="bg-red-50 p-3 rounded border border-red-200">
                    <label class="block text-xs font-bold text-red-600 uppercase mb-2">Content Type</label>
                    <div class="flex gap-4">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="contentType" value="1" class="w-4 h-4 text-red-600" checked>
                            <span class="text-sm font-bold text-gray-700">Adult (18+)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="contentType" value="0" class="w-4 h-4 text-blue-600">
                            <span class="text-sm font-bold text-gray-700">Family Safe</span>
                        </label>
                    </div>
                </div>

                <!-- Input -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Local File</label>
                    <input type="file" name="file" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer">
                </div>
                <div class="text-center text-gray-300 text-xs">- OR -</div>
                <div>
                    <input type="url" name="url" placeholder="Paste Remote URL" class="w-full px-3 py-2 border rounded text-sm">
                </div>

                <!-- API Key -->
                <div class="pt-2">
                    <input type="password" name="apiKey" id="apiKeyInput" placeholder="Thumbsnap API Key" class="w-full px-3 py-2 border rounded bg-gray-50 text-sm">
                </div>

                <button type="submit" class="w-full bg-gray-800 text-white py-3 rounded-lg hover:bg-black transition font-bold shadow-lg mt-2">
                    Start Upload
                </button>
            </form>

            <div id="loading" class="hidden mt-6 text-center">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full mb-2"></div>
                <p class="text-xs text-red-600 animate-pulse font-bold">Processing...</p>
            </div>

            <div id="error" class="hidden mt-4 p-3 bg-red-100 text-red-600 text-xs rounded border border-red-200 break-words font-mono"></div>

            <div id="resultArea" class="hidden mt-6 bg-gray-50 p-4 rounded-lg border text-center">
                <div class="flex gap-2 mb-2">
                    <input id="tsLink" readonly class="flex-1 text-sm bg-white border border-gray-300 p-2 rounded text-gray-700 select-all font-mono" />
                    <button onclick="copyLink()" class="bg-gray-200 px-3 py-1 rounded text-sm font-bold">Copy</button>
                </div>
                <img id="previewThumb" class="w-full h-40 object-contain rounded border bg-white mt-2" />
            </div>
        </div>

        <script>
            const apiKeyInput = document.getElementById('apiKeyInput');
            if(!apiKeyInput.placeholder.includes('Server')) {
                 apiKeyInput.value = localStorage.getItem('ts_api_key') || '';
            }
            apiKeyInput.addEventListener('change', () => localStorage.setItem('ts_api_key', apiKeyInput.value));

            const form = document.getElementById('uploadForm');
            const resultArea = document.getElementById('resultArea');
            const loading = document.getElementById('loading');
            const errorDiv = document.getElementById('error');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                resultArea.classList.add('hidden');
                errorDiv.classList.add('hidden');
                loading.classList.remove('hidden');

                const formData = new FormData(form);

                try {
                    const response = await fetch('/process', { method: 'POST', body: formData });
                    
                    // 🔥 FIX: Read as Text first to catch HTML errors
                    const textData = await response.text();
                    
                    let data;
                    try {
                        data = JSON.parse(textData);
                    } catch(e) {
                        // If JSON parse fails, show the HTML preview (Server Error)
                        console.error("Server HTML:", textData);
                        throw new Error("Server Error (Not JSON): " + textData.substring(0, 150) + "..."); 
                    }

                    if(data.error) throw new Error(data.error);

                    document.getElementById('tsLink').value = data.data.media;
                    document.getElementById('previewThumb').src = data.data.media;
                    resultArea.classList.remove('hidden');

                } catch (err) {
                    errorDiv.innerText = err.message;
                    errorDiv.classList.remove('hidden');
                } finally {
                    loading.classList.add('hidden');
                }
            });

            function copyLink() {
                const copyText = document.getElementById("tsLink");
                copyText.select();
                navigator.clipboard.writeText(copyText.value);
            }
        </script>
    </body>
    </html>
  `);
});

// 2. Backend Logic with Better Error Handling
app.post("/process", async (c) => {
  try {
    const body = await c.req.parseBody();
    let imageBuffer: ArrayBuffer | null = null;
    let originalSize = 0;
    
    const apiKey = (body['apiKey'] as string) || SERVER_API_KEY;
    const contentType = (body['contentType'] as string) || "0";

    // --- Input Handling ---
    if (body['file'] && body['file'] instanceof File) {
       if (body['file'].size === 0) return c.json({ error: "File is empty" }, 400);
       imageBuffer = await body['file'].arrayBuffer();
       originalSize = body['file'].size;
    } 
    else if (body['url'] && typeof body['url'] === 'string') {
       try {
           const resp = await fetch(body['url']);
           if (!resp.ok) return c.json({ error: `Cannot download URL (Status: ${resp.status})` }, 400);
           imageBuffer = await resp.arrayBuffer();
           originalSize = imageBuffer.byteLength;
       } catch(e) {
           return c.json({ error: "Invalid URL: " + e.message }, 400);
       }
    } else {
       return c.json({ error: "No file or URL selected" }, 400);
    }

    if (!imageBuffer) return c.json({ error: "Image buffer is null" }, 400);

    // --- Compression ---
    const TARGET_MAX = 60 * 1024; // 60KB
    let processedData = new Uint8Array(imageBuffer);

    // Try Catch for Image Decoding (Common Crash Point)
    try {
        if (originalSize > 50 * 1024) {
            const image = await Image.decode(new Uint8Array(imageBuffer));
            let quality = 80;
            
            // Loop reduction
            while (quality >= 10) {
                const temp = await image.encodeJPEG(quality);
                if (temp.byteLength <= TARGET_MAX) {
                    processedData = temp;
                    break;
                }
                processedData = temp; // Keep smallest so far
                quality -= 10;
            }
        }
    } catch (e) {
        // Fallback: If decoding fails (e.g. unsupported format), try uploading original
        console.error("Compression Failed:", e);
        // We will proceed with original file if compression fails
        processedData = new Uint8Array(imageBuffer);
    }

    // --- Upload to Thumbsnap ---
    if (!apiKey) return c.json({ error: "API Key is missing" }, 400);

    const formData = new FormData();
    formData.append("key", apiKey);
    if(contentType === '1') {
         formData.append("content", "1"); 
         formData.append("adult", "1");
    }
    formData.append("media", new Blob([processedData], { type: "image/jpeg" }), "image.jpg");

    const tsResp = await fetch("https://thumbsnap.com/api/tool/upload", { 
        method: "POST", 
        body: formData 
    });
    
    // Check if Thumbsnap itself returned HTML (Maintenance/Error)
    const tsText = await tsResp.text();
    let tsResult;
    try {
        tsResult = JSON.parse(tsText);
    } catch(e) {
        return c.json({ error: "Thumbsnap API Error (Not JSON): " + tsText.substring(0, 100) }, 502);
    }

    if (!tsResult.success) {
        return c.json({ error: "Thumbsnap Failed: " + (tsResult.error?.message || JSON.stringify(tsResult)) }, 400);
    }

    return c.json({
        success: true,
        data: tsResult.data,
        meta: { originalSize, newSize: processedData.byteLength }
    });

  } catch (globalErr) {
    // Catch-all for server crashes
    return c.json({ error: "System Error: " + globalErr.message }, 500);
  }
});

Deno.serve(app.fetch);
