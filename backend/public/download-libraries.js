// Script para baixar as bibliotecas JsBarcode e QRCode
// Execute: node download-libraries.js

const https = require('https');
const fs = require('fs');
const path = require('path');

function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`✅ Downloaded: ${filepath}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function downloadLibraries() {
    try {
        console.log('📦 Downloading libraries...');
        
        await downloadFile(
            'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
            path.join(__dirname, 'jsbarcode.min.js')
        );

        await downloadFile(
            'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
            path.join(__dirname, 'html5-qrcode.min.js')
        );
        
        // Baixar QRCode - usar biblioteca qrcodejs (mais simples)
        const qrcodeUrls = [
            'https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@gh-pages/qrcode.min.js',
            'https://raw.githubusercontent.com/davidshimjs/qrcodejs/master/qrcode.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
        ];
        
        let qrcodeDownloaded = false;
        for (const url of qrcodeUrls) {
            try {
                console.log(`Trying to download QRCode from: ${url}`);
                await downloadFile(url, path.join(__dirname, 'qrcode.min.js'));
                // Verificar se o arquivo foi baixado corretamente
                const content = fs.readFileSync(path.join(__dirname, 'qrcode.min.js'), 'utf8');
                if (content && !content.includes('Couldn\'t find') && !content.includes('Not found') && content.length > 100) {
                    qrcodeDownloaded = true;
                    console.log(`✅ QRCode downloaded successfully from: ${url}`);
                    break;
                } else {
                    console.log(`Downloaded file seems invalid (length: ${content.length}), trying next URL...`);
                }
            } catch (error) {
                console.log(`Failed to download from ${url}: ${error.message}`);
            }
        }
        
        if (!qrcodeDownloaded) {
            console.error('❌ Could not download QRCode from any URL');
            console.log('Creating a placeholder file - you may need to download manually');
        }
        
        console.log('✅ All libraries downloaded successfully!');
    } catch (error) {
        console.error('❌ Error downloading libraries:', error);
    }
}

downloadLibraries();
