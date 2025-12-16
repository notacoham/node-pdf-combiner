const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const folderInput = document.getElementById('folder-input');
const fileListContainer = document.getElementById('file-list-container');
const fileList = document.getElementById('file-list');
const fileCount = document.getElementById('file-count');
const clearBtn = document.getElementById('clear-btn');
const combineBtn = document.getElementById('combine-btn');

let selectedFiles = [];

// Drag & Drop Events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight() {
    dropZone.classList.add('drag-over');
}

function unhighlight() {
    dropZone.classList.remove('drag-over');
}

dropZone.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const items = dt.items;

    if (items) {
        // Use DataTransferItemList interface to access the file(s)
        const entries = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
                if (entry) {
                    entries.push(entry);
                } else {
                     // Fallback for non-webkit (rare now)
                     const file = items[i].getAsFile();
                     if (file) addFile(file);
                }
            }
        }
        if (entries.length > 0) {
            scanFiles(entries);
        }
    } else {
        // Use DataTransfer interface to access the file(s)
        const files = dt.files;
        handleFiles(files);
    }
}

// File Inputs
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
folderInput.addEventListener('change', (e) => handleFiles(e.target.files));

async function scanFiles(entries) {
    for (const entry of entries) {
        if (entry.isFile) {
            entry.file(file => {
                addFile(file);
                updateUI();
            });
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const readEntries = async () => {
                return new Promise((resolve) => {
                    dirReader.readEntries(async (subEntries) => {
                        if (subEntries.length > 0) {
                            await scanFiles(subEntries);
                            resolve(await readEntries()); // recursively read more if any (standard limits to 100)
                        } else {
                            resolve();
                        }
                    });
                });
            };
            await readEntries();
        }
    }
}


function handleFiles(files) {
    [...files].forEach(addFile);
    updateUI();
}

function addFile(file) {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Check for duplicates based on name and size? Or allow duplicates? 
        // Let's allow duplicates but maybe warn? For now simple append.
        selectedFiles.push(file);
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateUI();
}

clearBtn.addEventListener('click', () => {
    selectedFiles = [];
    updateUI();
});

const filenameContainer = document.getElementById('filename-container');
const filenameInput = document.getElementById('filename-input');

function updateUI() {
    fileList.innerHTML = '';
    
    if (selectedFiles.length === 0) {
        fileListContainer.classList.add('hidden');
        filenameContainer.classList.add('hidden');
        clearBtn.classList.add('hidden');
        combineBtn.disabled = true;
        combineBtn.innerText = 'Combine PDFs';
    } else {
        fileListContainer.classList.remove('hidden');
        filenameContainer.classList.remove('hidden');
        clearBtn.classList.remove('hidden');
        combineBtn.disabled = false;
        combineBtn.innerText = `Combine ${selectedFiles.length} PDFs`;

        selectedFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            // Icon
            const iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="file-icon" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

            li.innerHTML = `
                <div class="file-info">
                    ${iconSvg}
                    <span class="file-name" title="${file.name}">${file.name}</span>
                </div>
                <button class="remove-btn" onclick="removeFile(${index})" aria-label="Remove file">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            `;
            fileList.appendChild(li);
        });
    }
    fileCount.innerText = `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`;
}

// Combine Logic
combineBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    const originalText = combineBtn.innerText;
    combineBtn.innerText = 'Processing...';
    combineBtn.disabled = true;

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('pdfs', file);
    });

    try {
        const response = await fetch('/merge', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            
            // Determine filename
            let outputName = filenameInput.value.trim() || 'merged-document';
            // Ensure no extension is duplicated if user typed it
            if (outputName.toLowerCase().endsWith('.pdf')) {
                outputName = outputName.slice(0, -4);
            }
            outputName += '.pdf';

            // Auto download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = outputName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            combineBtn.innerText = 'Success!';
            setTimeout(() => {
                combineBtn.innerText = originalText; // Reset text but keep disabled if needed? No, user might want to merge again.
                if (selectedFiles.length > 0) combineBtn.disabled = false;
                combineBtn.innerText = `Combine ${selectedFiles.length} PDFs`;
            }, 2000);

        } else {
            alert('Failed to merge PDFs. Server error.');
            combineBtn.disabled = false;
            combineBtn.innerText = originalText;
        }
    } catch (error) {
        console.error(error);
        alert('An error occurred.');
        combineBtn.disabled = false;
        combineBtn.innerText = originalText;
    }
});
