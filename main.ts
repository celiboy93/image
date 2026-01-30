import { Hono } from "jsr:@hono/hono";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const app = new Hono();

// Server Environment Variable မှ Key ကို ယူမယ် (ရှိလျှင်)
const SERVER_API_KEY = Deno.env.get("THUMBSNAP_KEY") || "";

app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thumbsnap Uploader (Adult/Safe)</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
    </head>
    <body class="bg-slate-900 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
            <h1 class="text-xl font-bold mb-6 text-center text-slate-800 flex justify-center items-center gap-2">
                <i class="fa-solid fa-fire text-red-500"></i> Adult Photo Uploader
            </h1>
            
            <form id="uploadForm" class="space-y-5">
                
                <!-- 1. Content Type Selection -->
                <div class="bg-red-50 p-3 rounded-lg border border-red-100">
                    <label class="block text-xs font-bold text-red-500 uppercase mb-2">Content Type (အမျိုးအစားရွေးပါ)</label>
                    <div class="flex gap-4">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="contentType" value="1" class="w-4 h-4 text-red-600 focus:ring-red-500" checked>
                            <span class="text-sm font-bold text-gray-700">Adult (18+)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="contentType" value="0" class="w-4 h-4 text-blue-600 focus:ring-blue-500">
                            <span class="text-sm font-bold text-gray-700">Family Safe</span>
                        </label>
                    </div>
                </div>

                <!-- 2. Inputs -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Local File</label>
                    <input type="file" name="file" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer">
                </div>

                <div class="text-center text-gray-300 text-xs">- OR -</div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Remote URL</label>
                    <input type="url" name="url" placeholder="https://example.com/image.jpg" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                </div>

                <!-- API Key -->
                <div class="pt-2 border-t border-gray-100">
                    <div class="flex items-center justify-between mb-2">
                        <label class="text-[10px] font-bold text-gray-400 uppercase">API Key</label>
                        ${SERVER_API_KEY ? '<span class="text-[10px] text-green-600 bg-green-100 px-2 py-0.5 rounded font-bold">Auto Linked</span>' : ''}
                    </div>
                    <input type="password" name="apiKey" id="apiKeyInput" placeholder="${SERVER_API_KEY ? 'Using Server Key' : 'Thumbsnap API Key'}" class="w-full px-3 py-2 border rounded bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                </div>

                <button type="submit" class="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-black transition font-bold shadow-lg mt-2">
                    Upload Now
                </button>
            </form>

            <!-- Loading -->
            <div id="loading" class="hidden mt-6 text-center">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full mb-2"></div>
                <p class="text-xs text-red-600 animate-pulse font-bold">Compressing & Uploading...</p>
            </div>

            <!-- Error -->
            <div id="error" class="hidden mt-4 p-3 bg-red-100 text-red-600 text-sm rounded text-center border border-red-200"></div>

            <!-- Result -->
            <div id="resultArea" class="hidden mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                <div class="mb-3 relative group">
                    <img id="previewThumb" class="w-full h-48 object-contain rounded border bg-white" />
                    <div id="adultBadge" class="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-1 rounded font-bold hidden">18+ ADULT</div>
                </div>
                
                <div class="flex gap-2 mb-2">
                    <input id="tsLink" readonly class="flex-1 text-sm bg-white border border-gray-300 p-2 rounded text-gray-700 select-all font-mono" />
                    <button onclick="copyLink()" class="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-sm font-bold"><i class="fa-regular fa-copy"></i></button>
                </div>

                <div class="text-[10px] text-gray-400 flex justify-center gap-4 mt-2">
                   <span>Reduced: <b id="orgSize"></b> -> <b id="newSize" class="text-green-600"></b></span>
                </div>
            </div>
        </div>

        <script>
            // Local Storage Logic
            const apiKeyInput = document.getElementById('apiKeyInput');
            if(!apiKeyInput.placeholder.includes('Server Key')) {
                 apiKeyInput.value = localStorage.getItem('ts_api_key') || '';
            }
            apiKeyInput.addEventListener('change', () => localStorage.setItem('ts_api_key', apiKeyInput.value));

            const form = document.getElementById('uploadForm');
            const resultArea = document.getElementById('resultArea');
            const loading = document.getElementById('loading');
            const errorDiv = document.getElementById('error');
            const adultBadge = document.getElementById('adultBadge');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                resultArea.classList.add('hidden');
                errorDiv.classList.add('hidden');
                loading.classList.remove('hidden');
                adultBadge.classList.add('hidden');

                const formData = new FormData(form);
                const isAdult = formData.get('contentType') === '1';

                try {
                    const response = await fetch('/process', { method: 'POST', body: formData });
                    const data = await response.json();

                    if(data.error) throw new Error(data.error);

                    document.getElementById('tsLink').value = data.data.media;
                    document.getElementById('previewThumb').src = data.data.media;
                    document.getElementById('orgSize').innerText = (data.meta.originalSize / 1024).toFixed(0) + 'KB';
                    document.getElementById('newSize').innerText = (data.meta.newSize / 1024).toFixed(0) + 'KB';

                    if(isAdult) adultBadge.classList.remove('hidden');

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

// 2. Backend Logic
app.post("/process", async (c) => {
  try {
    const body = await c.req.parseBody();
    let imageBuffer: ArrayBuffer | null = null;
    let originalSize = 0;
    
    const apiKey = (body['apiKey'] as string) || SERVER_API_KEY;
    
    // 🔥 Content Type (0 = Safe, 1 = Adult)
    const contentType = (body['contentType'] as string) || "0";

    // --- INPUT HANDLING ---
    if (body['file'] && body['file'] instanceof File && body['file'].size > 0) {
      imageBuffer = await body['file'].arrayBuffer();
      originalSize = body['file'].size;
    } 
    else if (body['url'] && typeof body['url'] === 'string' && body['url'].trim() !== "") {
      const resp = await fetch(body['url']);
      if (!resp.ok) return c.json({ error: "Remote URL Error" }, 400);
      imageBuffer = await resp.arrayBuffer();
      originalSize = imageBuffer.byteLength;
    } else {
      return c.json({ error: "No image provided" }, 400);
    }

    // --- COMPRESS (Under 60KB) ---
    const TARGET_MAX = 60 * 1024;
    const LIMIT_MIN = 50 * 1024;
    
    // Decode
    const image = await Image.decode(new Uint8Array(imageBuffer));
    let processedData = new Uint8Array(imageBuffer);
    
    // Only compress if original > 50KB
    if (originalSize > LIMIT_MIN) {
        let quality = 80;
        while (quality >= 10) {
            const temp = await image.encodeJPEG(quality);
            if (temp.byteLength <= TARGET_MAX) { processedData = temp; break; }
            processedData = temp;
            quality -= 10;
        }
    }

    // --- UPLOAD TO THUMBSNAP ---
    if (apiKey && apiKey.trim() !== "") {
        const formData = new FormData();
        formData.append("key", apiKey);
        
        // 🔥 Adult Setting Here 🔥
        // Thumbsnap API often accepts 'content' param (1 for Adult)
        if(contentType === '1') {
             formData.append("content", "1"); 
             // Just to be safe, some API versions use 'adult'
             formData.append("adult", "1");
        } else {
             formData.append("content", "0");
        }

        formData.append("media", new Blob([processedData], { type: "image/jpeg" }), "image.jpg");

        const tsResp = await fetch("https://thumbsnap.com/api/tool/upload", { method: "POST", body: formData });
        const tsResult = await tsResp.json();
        
        if (!tsResult.success) return c.json({ error: "Thumbsnap Error: " + (tsResult.error?.message || "Unknown") }, 500);

        return c.json({
            success: true,
            data: tsResult.data,
            meta: { originalSize, newSize: processedData.byteLength }
        });
    } else {
        return c.json({ error: "API Key Missing!" }, 400);
    }

  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

Deno.serve(app.fetch);
