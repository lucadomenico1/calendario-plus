const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function extractText() {
    const data = new Uint8Array(fs.readFileSync('ttPdf.pdf'));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let textStr = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        let items = textContent.items;
        items.sort((a, b) => {
            if (Math.abs(a.transform[5] - b.transform[5]) > 5) {
                return b.transform[5] - a.transform[5];
            }
            return a.transform[4] - b.transform[4];
        });
        
        for (const item of items) {
            textStr += item.str + " ";
        }
    }
    fs.writeFileSync('dump.txt', textStr);
}
extractText();
