// PDF to Image converter - pure frontend
// uses PDF.js from CDN

let pdfDoc = null;
let currentFile = null;
let images = [];

// DOM elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const settingsSection = document.getElementById('settings');
const progressSection = document.getElementById('progress');
const resultSection = document.getElementById('result');
const convertBtn = document.getElementById('convert-btn');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const imageList = document.getElementById('image-list');
const resultStats = document.getElementById('result-stats');
const downloadAllBtn = document.getElementById('download-all-btn');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');

// Event listeners
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

// Drag and drop
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// Quality slider
qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = qualitySlider.value + '%';
});

convertBtn.addEventListener('click', convertPdfToImages);

downloadAllBtn.addEventListener('click', downloadAllAsZip);

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('请选择 PDF 文件');
        return;
    }
    currentFile = file;
    settingsSection.style.display = 'block';
    resultSection.style.display = 'none';
}

async function convertPdfToImages() {
    if (!currentFile) return;

    progressSection.style.display = 'block';
    resultSection.style.display = 'none';
    images = [];

    const dpi = parseInt(document.getElementById('dpi').value);
    const format = document.getElementById('format').value;
    const quality = parseInt(document.getElementById('quality').value) / 100;

    try {
        const arrayBuffer = await readFileAsArrayBuffer(currentFile);
        pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        const numPages = pdfDoc.numPages;

        resultStats.textContent = `文件名：${currentFile.name}，共 ${numPages} 页`;

        for (let i = 1; i <= numPages; i++) {
            progressFill.style.width = `${(i - 1) / numPages * 100}%`;
            progressText.textContent = `正在转换第 ${i}/${numPages} 页...`;

            const page = await pdfDoc.getPage(i);
            const image = await renderPageToImage(page, dpi, format, quality);
            images.push({
                pageNum: i,
                dataUrl: image.dataUrl,
                blob: image.blob
            });

            // Yield to UI
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        progressFill.style.width = '100%';
        progressText.textContent = `完成！共转换 ${numPages} 页`;

        displayResults();
        progressSection.style.display = 'none';
        resultSection.style.display = 'block';
    } catch (error) {
        console.error(error);
        alert('转换出错：' + error.message);
        progressSection.style.display = 'none';
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function renderPageToImage(page, dpi, format, quality) {
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    await page.render(renderContext).promise;

    return new Promise((resolve) => {
        if (format === 'png') {
            canvas.toBlob((blob) => {
                resolve({
                    blob,
                    dataUrl: URL.createObjectURL(blob)
                });
            }, 'image/png');
        } else {
            canvas.toBlob((blob) => {
                resolve({
                    blob,
                    dataUrl: URL.createObjectURL(blob)
                });
            }, 'image/jpeg', quality);
        }
    });
}

function displayResults() {
    imageList.innerHTML = '';
    images.forEach((img) => {
        const item = document.createElement('div');
        item.className = 'image-item';
        item.innerHTML = `
            <img src="${img.dataUrl}" alt="Page ${img.pageNum}">
            <div class="page-name">第 ${img.pageNum} 页</div>
            <button class="download-btn" data-index="${img.pageNum - 1}">下载</button>
        `;
        item.querySelector('.download-btn').addEventListener('click', () => {
            downloadSingleImage(img);
        });
        imageList.appendChild(item);
    });
}

function downloadSingleImage(img) {
    const format = document.getElementById('format').value;
    const ext = format === 'png' ? 'png' : 'jpg';
    const filename = `${currentFile.name.replace(/\.pdf$/i, '')}_page_${String(img.pageNum).padStart(3, '0')}.${ext}`;
    downloadBlob(img.blob, filename);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function downloadAllAsZip() {
    if (images.length === 0) return;

    const zip = new JSZip();
    const format = document.getElementById('format').value;
    const ext = format === 'png' ? 'png' : 'jpg';
    const baseName = currentFile.name.replace(/\.pdf$/i, '');

    images.forEach((img) => {
        const filename = `${baseName}_page_${String(img.pageNum).padStart(3, '0')}.${ext}`;
        zip.file(filename, img.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `${baseName}_images.zip`);
}

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
