import { Hono } from "jsr:@hono/hono";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const app = new Hono();

// 🔥 အစ်ကို့ API Key ကို ဒီမှာ တခါတည်း ထည့်ပေးထားပါတယ် 🔥
const API_KEY = "0004640d6fb420fbe95d270e65ab0ccb";
// 🔥 Correct Endpoint from your docs 🔥
const API_URL = "https://thumbsnap.com/api/upload";

app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thumbsnap Uploader</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
    </head>
    <body class="bg-slate-900 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
            <h1 class="text-xl font-bold mb-6 text-center text-slate-800">
                <i class="fa-solid fa-cloud-arrow-up text-blue-600"></i> Thumbsnap Uploader
            </h1>
            
            <form id="uploadForm" class="space-y-4">
                
                <!-- Input -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Select File</label>
                    <input type="file" name="file" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer">
                </div>
                
                <div class="text-center text-gray-300 text-xs">- OR -</div>
                
                <div>
                    <input type="url" name="url" placeholder="Paste Remote Image URL" class="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                </div>

                <!-- API Key Info (Read Only) -->
                <div class="bg-green-50 p-2 rounded border border-green-200 text-center">
                    <p class="text-[10px] text-green-700 font-bold">
                        <i class="fa-solid fa-check-circle"></i> API Key Active: ...0ccb
                    </p>
                </div>

                <button type="submit" class="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-black transition font-bold shadow-lg mt-2">
                    Upload Now
                </button>
            </form>

            <div id="loading" class="hidden mt-6 text-center">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2"></div>
                <p class="text-xs text-blue-600 animate-pulse font-bold">Compressing & Uploading...</p>
            </div>

            <div id="error" class="hidden mt-4 p-3 bg-red-100 text-red-600 text-xs rounded border border-red-200 break-words font-mono"></div>

            <div id="resultArea" class="hidden mt-6 bg-slate-50 p-4 rounded-lg border text-center">
                <div class="flex gap-2 mb-2">
                    <input id="tsLink" readonly class="flex-1 text-sm bg-white border border-gray-300 p-2 rounded text-gray-700 select-all font-mono" />
                    <button onclick="copyLink()" class="bg-gray-200 px-3 py-1 rounded text-sm font-bold">Copy</button>
                </div>
                <div class="flex gap-2 mb-2">
                    <input id="tsDirect" readonly class="flex-1 text-[10px] bg-white border border-gray-300 p-2 rounded text-gray-500 select-all font-mono" />
                    <span class="text-[10px] self-center text-gray-400">Direct</span>
                </div>
                <img id="previewThumb" class="w-full h-40 object-contain rounded border bg-white mt-2" />
            </div>
        </div>

        <script>
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
                    const textData = await response.text(); // Raw text first
                    
                    let data;
                    try {
                        data = JSON.parse(textData);
                    } catch(e) {
                        console.error(textData);
                        throw new Error("Server Error: " + textData.substring(0, 100));
                    }

                    if(data.error) throw new Error(data.error);

                    // Docs say: data.data.url (Page), data.data.media (Direct Image)
                    document.getElementById('tsLink').value = data.data.url; 
                    document.getElementById('tsDirect').value = data.data.media;
                    document.getElementById('previewThumb').src = data.data.thumb;
                    
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
    
    // --- Input Handling ---
    if (body['file'] && body['file'] instanceof File && body['file'].size > 0) {
       imageBuffer = await body['file'].arrayBuffer();
       originalSize = body['file'].size;
    } 
    else if (body['url'] && typeof body['url'] === 'string' && body['url'].trim() !== "") {
       try {
           const resp = await fetch(body['url']);
           if (!resp.ok) return c.json({ error: "Invalid URL" }, 400);
           imageBuffer = await resp.arrayBuffer();
           originalSize = imageBuffer.byteLength;
       } catch(e) {
           return c.json({ error: "Fetch Error: " + e.message }, 400);
       }
    } else {
       return c.json({ error: "Please select a file" }, 400);
    }

    // --- Compression (Target < 60KB) ---
    // If < 50KB, use original. If > 50KB, compress.
    let processedData = new Uint8Array(imageBuffer);
    
    if (originalSize > 50 * 1024) {
        try {
            const image = await Image.decode(new Uint8Array(imageBuffer));
            let quality = 80;
            const TARGET_MAX = 60 * 1024;

            while (quality >= 10) {
                const temp = await image.encodeJPEG(quality);
                if (temp.byteLength <= TARGET_MAX) {
                    processedData = temp;
                    break;
                }
                processedData = temp;
                quality -= 10;
            }
        } catch (e) {
            console.error("Compression failed, using original", e);
            // If compression fails (unsupported format), we stick with original
        }
    }

    // --- UPLOAD TO THUMBSNAP ---
    // Docs: POST multipart/form-data, fields: key, media
    const formData = new FormData();
    formData.append("key", API_KEY);
    formData.append("media", new Blob([processedData], { type: "image/jpeg" }), "upload.jpg");

    // 🔥 Using correct URL: https://thumbsnap.com/api/upload 🔥
    const tsResp = await fetch(API_URL, { 
        method: "POST", 
        body: formData 
    });
    
    const tsText = await tsResp.text();
    let tsResult;
    try {
        tsResult = JSON.parse(tsText);
    } catch(e) {
        return c.json({ error: "Thumbsnap Bad Response: " + tsText }, 500);
    }

    if (!tsResult.success) {
        return c.json({ error: "Thumbsnap API Error: " + (tsResult.error?.message || "Unknown") }, 400);
    }

    return c.json({
        success: true,
        data: tsResult.data // Contains .url, .media, .thumb
    });

  } catch (globalErr) {
    return c.json({ error: "System Error: " + globalErr.message }, 500);
  }
});

Deno.serve(app.fetch);
