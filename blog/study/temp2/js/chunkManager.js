// New file: chunkManager.js
const ChunkManager = {
    CHUNK_SIZE: 10 * 1024 * 1024, // 10MB chunks

    async exportInChunks(data) {
        const loading = this.showLoadingDialog('Exporting canvas...');
        try {
            const chunks = [];
            const serializedData = JSON.stringify(data);

            for (let i = 0; i < serializedData.length; i += this.CHUNK_SIZE) {
                chunks.push(serializedData.slice(i, i + this.CHUNK_SIZE));
                await this.updateProgress(loading, (i / serializedData.length) * 100);
            }

            const blob = new Blob(chunks, { type: 'application/json' });
            return blob;
        } finally {
            this.hideLoadingDialog(loading);
        }
    },

    async importFromChunks(file) {
        const loading = this.showLoadingDialog('Importing canvas...');
        try {
            const chunks = [];
            let offset = 0;

            while (offset < file.size) {
                const chunk = await this.readChunk(file, offset);
                chunks.push(chunk);
                offset += this.CHUNK_SIZE;
                await this.updateProgress(loading, (offset / file.size) * 100);
            }

            const data = chunks.join('');
            return JSON.parse(data);
        } finally {
            this.hideLoadingDialog(loading);
        }
    },

    readChunk(file, offset) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            const blob = file.slice(offset, offset + this.CHUNK_SIZE);
            reader.onload = e => resolve(e.target.result);
            reader.readAsText(blob);
        });
    },

    showLoadingDialog(message) {
        const dialog = document.createElement('div');
        dialog.className = 'loading-dialog';
        dialog.innerHTML = `
            <div class="loading-content">
                <h3>${message}</h3>
                <div class="progress-bar">
                    <div class="progress"></div>
                </div>
                <div class="progress-text">0%</div>
            </div>
        `;
        document.body.appendChild(dialog);
        return dialog;
    },

    hideLoadingDialog(dialog) {
        dialog.remove();
    },

    async updateProgress(dialog, percent) {
        const progress = dialog.querySelector('.progress');
        const text = dialog.querySelector('.progress-text');
        progress.style.width = `${percent}%`;
        text.textContent = `${Math.round(percent)}%`;
        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));
    }
};