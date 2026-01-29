import { Hono } from "jsr:@hono/hono";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const app = new Hono();

// 1. Frontend UI (HTML)
app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Data Compressor (Deno Friendly)</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-100 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white p-6 rounded-xl shadow-lg w-full max-w-md border border-slate-200">
            <h1 class="text-xl font-bold mb-2 text-center text-slate-800">Deno Data Compressor</h1>
            <p class="text-center text-xs text-red-500 mb-6 font-semibold">
                (No Resize - Quality Reduction Only)
            </p>
            
            <form id="uploadForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Local File</label>
                    <input type="file" name="file" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer">
                </div>

                <div class="text-center text-gray-400 text-xs py-1">- OR -</div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Remote URL</label>
                    <input type="url" name="url" placeholder="https://example.com/image.jpg" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                </div>

                <button type="submit" id="submitBtn" class="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 transition font-medium">
                    Compress Data Only
                </button>
            </form>

            <div id="loading" class="hidden mt-6 text-center text-indigo-600 text-sm animate-pulse">
                Processing image...
            </div>

            <div id="error" class="hidden mt-4 p-3 bg-red-100 text-red-600 text-sm rounded text-center"></div>

            <div id="resultArea" class="hidden mt-6 bg-slate-50 p-4 rounded border">
                <div class="flex justify-between text-xs font-mono mb-2">
                    <span>Original: <b id="orgSize"></b></span>
                    <span>New: <b id="newSize" class="text-green-600"></b></span>
                </div>
                <div class="text-xs text-gray-500 mb-2 text-center" id="qualityInfo"></div>
                
                <img id="previewImg" class="w-full h-auto rounded border bg-white mb-3" />
                
                <a id="downloadLink" href="#" download="compressed.jpg" class="block w-full text-center bg-green-600 text-white py-2 rounded hover:bg-green-700 transition text-sm">
                    Download
                </a>
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
                    const response = await fetch('/process', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) throw new Error(await response.text());

                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    
                    const orgSize = response.headers.get('X-Original-Size');
                    const newSize = response.headers.get('X-New-Size');
                    const finalQuality = response.headers.get('X-Final-Quality');

                    document.getElementById('previewImg').src = url;
                    document.getElementById('downloadLink').href = url;
                    document.getElementById('orgSize').innerText = (orgSize / 1024).toFixed(2) + ' KB';
                    document.getElementById('newSize').innerText = (newSize / 1024).toFixed(2) + ' KB';
                    
                    document.getElementById('qualityInfo').innerText = finalQuality 
                        ? "Quality reduced to: " + finalQuality + "%"
                        : "No changes made";

                    resultArea.classList.remove('hidden');
                } catch (err) {
                    errorDiv.innerText = err.message;
                    errorDiv.classList.remove('hidden');
                } finally {
                    loading.classList.add('hidden');
                }
            });
        </script>
    </body>
    </html>
  `);
});

// 2. Backend Logic (Using ImageScript for Deno Deploy Compatibility)
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
      const resp = await fetch(body['url']);
      if (!resp.ok) return c.text("URL fetch failed", 400);
      imageBuffer = await resp.arrayBuffer();
      originalSize = imageBuffer.byteLength;
    } else {
      return c.text("No file or URL provided", 400);
    }

    if (!imageBuffer) return c.text("Invalid Data", 400);

    // Limits
    const LIMIT_MIN = 50 * 1024; // 50 KB
    const TARGET_MAX = 60 * 1024; // 60 KB

    // 1. Check Original Size
    if (originalSize <= LIMIT_MIN) {
        return new Response(imageBuffer, {
            headers: {
                "Content-Type": "image/jpeg",
                "X-Original-Size": originalSize.toString(),
                "X-New-Size": originalSize.toString(),
            },
        });
    }

    // 2. Compression Logic (No Resize)
    // Decode image (ImageScript works with PNG/JPEG)
    const image = await Image.decode(new Uint8Array(imageBuffer));
    
    let processedData = new Uint8Array(imageBuffer);
    let quality = 80;
    let bestFitData = null;

    // Loop to find best quality under 60KB
    // We start at 80% and go down to 10%
    while (quality >= 10) {
        // Encode as JPEG with current quality
        const tempBuffer = await image.encodeJPEG(quality);

        if (tempBuffer.byteLength <= TARGET_MAX) {
            bestFitData = tempBuffer;
            break; // Found target size!
        }
        
        // Keep tracking the smallest we found so far
        bestFitData = tempBuffer;
        quality -= 10;
    }

    // Use the best fit (or the smallest we could get)
    processedData = bestFitData || new Uint8Array(imageBuffer);
    
    // If even lowest quality is bigger than original (rare but possible with optimized originals), use original
    if (processedData.byteLength > originalSize) {
        processedData = new Uint8Array(imageBuffer);
    }

    return new Response(processedData, {
      headers: {
        "Content-Type": "image/jpeg",
        "X-Original-Size": originalSize.toString(),
        "X-New-Size": processedData.byteLength.toString(),
        "X-Final-Quality": quality.toString(),
      },
    });

  } catch (err) {
    console.error(err);
    return c.text("Error processing image (Format might not be supported): " + err.message, 500);
  }
});

Deno.serve(app.fetch);
