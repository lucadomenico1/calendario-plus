document.addEventListener('DOMContentLoaded', () => {
    // Setup PDF.js
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // DOM Elements
    const uploadSection = document.getElementById('upload-section');
    const uploadStatus = document.getElementById('upload-status');
    const searchSection = document.getElementById('search-section');
    const subjectInput = document.getElementById('subject-input');
    const autocompleteList = document.getElementById('autocomplete-list');
    
    const profContainer = document.getElementById('professors-container');
    const profList = document.getElementById('professors-list');
    
    const appelliContainer = document.getElementById('appelli-container');
    const appelliList = document.getElementById('appelli-list');
    
    const savedExamsList = document.getElementById('saved-exams-list');

    // Action buttons
    const syncExamsBtn = document.getElementById('sync-exams-btn');
    const shareExamsBtn = document.getElementById('share-exams-btn');
    const clearAllExamsBtn = document.getElementById('clear-all-exams-btn');

    // Sync Modal elements
    const syncModal = document.getElementById('sync-modal');
    const closeSyncModalBtn = document.getElementById('close-sync-modal');
    const cancelSyncModalBtn = document.getElementById('cancel-sync-modal-btn');
    const copySyncLinkBtn = document.getElementById('copy-sync-link-btn');
    const qrcodeContainer = document.getElementById('qrcode-container');

    // Manual form elements
    const showManualFormBtn = document.getElementById('show-manual-form-btn');
    const manualExamForm = document.getElementById('manual-exam-form');
    const saveManualBtn = document.getElementById('save-manual-btn');
    const cancelManualBtn = document.getElementById('cancel-manual-btn');

    let allExams = []; 
    let groupedExams = {}; 
    let subjectYearMap = {}; // { "MATERIA": Set(["1° Anno", ...]) }
    let selectedYearFilter = 'ALL';
    let savedExams = JSON.parse(localStorage.getItem('calendarioPlusExams')) || [];

    // Initialize
    renderSavedExams();
    setInterval(renderSavedExams, 60000); 
    checkIncomingSync(); 

    // Auto-load PDF on startup
    async function loadDatabase() {
        try {
            uploadStatus.textContent = 'Scaricamento e lettura del database in corso...';
            
            // Possibili percorsi del file (permette la massima comodità di aggiornamento)
            const candidatePaths = [
                './calendario/calendario.pdf',
                './calendario/ttPdf.pdf',
                './calendario/esami.pdf',
                './ttPdf.pdf'
            ];

            let response = null;
            for (const path of candidatePaths) {
                try {
                    const res = await fetch(path, { cache: 'no-cache' });
                    if (res.ok) {
                        response = res;
                        break;
                    }
                } catch (e) {
                    // Prova percorso successivo
                }
            }

            if (!response) {
                throw new Error("File PDF del calendario non trovato nella cartella 'calendario'.");
            }

            const arrayBuffer = await response.arrayBuffer();
            
            const text = await extractTextFromPDF(arrayBuffer);
            allExams = parseTextToExams(text);
            buildGroupedExams();
            
            uploadStatus.textContent = `Database caricato: ${allExams.length} appelli pronti!`;
            setTimeout(() => {
                uploadSection.classList.add('hidden');
                searchSection.classList.remove('hidden');
            }, 800);
        } catch (error) {
            console.error(error);
            uploadStatus.textContent = 'Errore: file PDF non trovato nella cartella "calendario". Inserisci "calendario.pdf" e ricarica la pagina.';
        }
    }

    // Avvia caricamento al lancio
    window.addEventListener('DOMContentLoaded', loadDatabase);

    // Manual form logic
    showManualFormBtn.addEventListener('click', () => {
        manualExamForm.classList.remove('hidden');
        showManualFormBtn.classList.add('hidden');
    });

    cancelManualBtn.addEventListener('click', () => {
        manualExamForm.classList.add('hidden');
        showManualFormBtn.classList.remove('hidden');
    });

    saveManualBtn.addEventListener('click', () => {
        const name = document.getElementById('manual-exam-name').value.trim();
        const prof = document.getElementById('manual-prof-name').value.trim() || 'N/D';
        const dateVal = document.getElementById('manual-date').value;
        const timeVal = document.getElementById('manual-time').value || 'N/D';
        const roomVal = document.getElementById('manual-room').value.trim() || 'Non specificata';

        if (!name || !dateVal) {
            alert('Inserisci almeno il nome della materia e la data!');
            return;
        }

        const [year, month, day] = dateVal.split('-');
        const dateStr = `${day}-${month}-${year}`;
        const parsedDate = new Date(`${year}-${month}-${day}T00:00:00`);

        const customExam = {
            id: 'manual_' + Math.random().toString(36).substr(2, 9),
            examName: name + ' (Intercorso)',
            profName: prof,
            dateStr: dateStr,
            ora: timeVal,
            aula: roomVal,
            appelloDetails: 'Prova Intercorso aggiunta manualmente',
            yearLevel: 'Intercorso',
            timestamp: parsedDate.getTime(),
            isManual: true
        };

        saveExam(customExam);
        
        manualExamForm.classList.add('hidden');
        showManualFormBtn.classList.remove('hidden');
        document.getElementById('manual-exam-name').value = '';
        document.getElementById('manual-prof-name').value = '';
        document.getElementById('manual-date').value = '';
        document.getElementById('manual-time').value = '';
        document.getElementById('manual-room').value = '';
    });

    // Helper per Badge Anno
    function getBadgeHtml(yearLevel) {
        if (!yearLevel || yearLevel === 'Altro') return '';
        let cls = 'badge-anno-altro';
        if (yearLevel === '1° Anno') cls = 'badge-anno-1';
        else if (yearLevel === '2° Anno') cls = 'badge-anno-2';
        else if (yearLevel === '3° Anno') cls = 'badge-anno-3';
        else if (yearLevel === 'Magistrale') cls = 'badge-anno-mag';
        return `<span class="year-badge ${cls}">${yearLevel}</span>`;
    }

    // Close autocomplete when clicking outside
    document.addEventListener("click", function (e) {
        if (e.target !== subjectInput && e.target !== autocompleteList) {
            autocompleteList.innerHTML = '';
        }
    });

    // --- SEARCH & AUTOCOMPLETE ---
    function triggerSearch() {
        const val = subjectInput.value.trim();
        autocompleteList.innerHTML = '';
        profContainer.classList.add('hidden');
        appelliContainer.classList.add('hidden');

        if (!val) return;

        const subjects = Object.keys(groupedExams);
        const matches = subjects.filter(s => s.toLowerCase().includes(val.toLowerCase()));
        renderAutocompleteSuggestions(matches.slice(0, 10), val);
    }

    function renderAutocompleteSuggestions(matches, query) {
        autocompleteList.innerHTML = '';
        if (matches.length === 0 && query) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.opacity = '0.7';
            emptyDiv.style.padding = '12px 16px';
            emptyDiv.textContent = 'Nessuna materia trovata';
            autocompleteList.appendChild(emptyDiv);
            return;
        }

        matches.forEach(match => {
            const div = document.createElement('div');
            if (query) {
                const regex = new RegExp(`(${query})`, "gi");
                div.innerHTML = match.replace(regex, "<strong>$1</strong>");
            } else {
                div.innerHTML = match;
            }
            
            div.addEventListener('click', () => {
                subjectInput.value = match;
                autocompleteList.innerHTML = '';
                selectSubject(match);
            });
            autocompleteList.appendChild(div);
        });
    }

    subjectInput.addEventListener('input', triggerSearch);

    function selectSubject(subject) {
        appelliContainer.classList.add('hidden');
        profList.innerHTML = '';
        
        const professors = Object.keys(groupedExams[subject]);
        
        professors.forEach(prof => {
            const btn = document.createElement('button');
            btn.className = 'chip fade-in';
            btn.textContent = prof;
            btn.addEventListener('click', () => {
                profList.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                selectProfessor(subject, prof);
            });
            profList.appendChild(btn);
        });
        
        profContainer.classList.remove('hidden');
    }

    function selectProfessor(subject, prof) {
        const exams = groupedExams[subject][prof];
        appelliList.innerHTML = '';
        
        exams.forEach(exam => {
            const isSaved = savedExams.some(e => e.id === exam.id || (e.examName === exam.examName && e.dateStr === exam.dateStr));
            const badgeHtml = getBadgeHtml(exam.yearLevel);
            
            const card = document.createElement('div');
            card.className = 'result-card fade-in';
            card.innerHTML = `
                ${badgeHtml}
                <h3>Appello: ${exam.dateStr}</h3>
                <div class="info-grid">
                    <p><strong>Ora:</strong> ${exam.ora}</p>
                    <p><strong>Aula/Note:</strong> ${exam.aula}</p>
                </div>
                <button class="btn" ${isSaved ? 'disabled' : ''}>
                    ${isSaved ? 'Già Salvato' : 'Salva Promemoria'}
                </button>
            `;

            const btn = card.querySelector('button');
            if (!isSaved) {
                btn.addEventListener('click', () => {
                    saveExam(exam);
                    btn.disabled = true;
                    btn.textContent = 'Già Salvato';
                });
            }

            appelliList.appendChild(card);
        });
        
        appelliContainer.classList.remove('hidden');
    }

    // --- PARSING LOGIC ---
    async function extractTextFromPDF(pdfData) {
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            const items = textContent.items.slice().sort((a, b) => {
                if (Math.abs(b.transform[5] - a.transform[5]) > 5) {
                    return b.transform[5] - a.transform[5];
                }
                return a.transform[4] - b.transform[4];
            });
            
            fullText += items.map(item => item.str).join(' ') + " ";
        }
        return fullText;
    }

    function parseTextToExams(text) {
        text = text.replace(/\s+/g, ' ');
        const exams = [];
        
        const parts = text.split(/(?=I\s+appello:|II\s+appello:|III\s+appello:|IV\s+appello:|V\s+appello:)/i);
        if (parts.length < 2) return exams;

        let currentExamInfo = parts[0];

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            const dateMatch = part.match(/(\d{2}-\d{2}-\d{4})/);
            if (!dateMatch) {
                currentExamInfo += " " + part;
                continue;
            }

            const dateStr = dateMatch[1];
            const timeMatch = part.match(/\d{2}:\d{2}/);
            let appelloEndIndex = part.length;

            if (timeMatch) {
                appelloEndIndex = Math.min(timeMatch.index + 80, part.length); 
            } else {
                appelloEndIndex = Math.min(dateMatch.index + 50, part.length);
            }

            let appelloDetails = part.substring(0, appelloEndIndex).trim();
            const nextExamRegex = /\s\d+\s+[A-ZÀ-Ú]/;
            const nextExamMatch = appelloDetails.match(nextExamRegex);
            if (nextExamMatch) {
                appelloDetails = appelloDetails.substring(0, nextExamMatch.index).trim();
                appelloEndIndex = part.indexOf(appelloDetails) + appelloDetails.length;
            }

            const nextExamInfo = part.substring(appelloEndIndex);

            let examName = "Esame Sconosciuto";
            let profName = "N/D";
            
            const yearRegex = /\d{4}\/\d{4}/; 
            const yearMatches = [...currentExamInfo.matchAll(new RegExp(yearRegex, 'g'))];
            
            if (yearMatches.length > 0) {
                const lastYearMatch = yearMatches[yearMatches.length - 1];
                let textBeforeYear = currentExamInfo.substring(0, lastYearMatch.index).trim();
                
                const numMatches = [...textBeforeYear.matchAll(/(?:^|\s)(\d+)\s+/g)];
                if (numMatches.length > 0) {
                    const lastNumMatch = numMatches[numMatches.length - 1];
                    textBeforeYear = textBeforeYear.substring(lastNumMatch.index + lastNumMatch[0].length).trim();
                }
                
                const words = textBeforeYear.split(/\s+/);
                let splitIndex = -1;
                
                const coursePreps = ["and"]; // Lowercase words that are part of the exam name

                for (let w = 0; w < words.length; w++) {
                    if (/[a-zà-ù]/.test(words[w])) {
                        if (coursePreps.includes(words[w].toLowerCase())) {
                            continue; // Skip this, it belongs to the exam name
                        }
                        
                        splitIndex = w;
                        
                        if (splitIndex > 0 && !/[a-zà-ù]/.test(words[splitIndex - 1])) {
                            splitIndex--; // Backtrack for surname
                            const prepositions = ["DE", "DI", "D'", "DEL", "DELL'", "DELLA", "LO", "LA", "VAN", "VON"];
                            if (splitIndex > 0) {
                                const prevWord = words[splitIndex - 1].toUpperCase();
                                if (prepositions.includes(prevWord) || prevWord.endsWith("'")) {
                                    splitIndex--; 
                                }
                            }
                        }
                        break;
                    }
                }
                
                // Fallback if no lowercase letters were found in the professor's name
                if (splitIndex === -1) {
                    const slashIndex = words.indexOf("/");
                    if (slashIndex > 1) {
                        splitIndex = slashIndex - 2; // Usually 2 words before the slash
                    } else if (words.length > 2) {
                        splitIndex = words.length - 2; // Assume last 2 words are the professor
                    }
                }

                if (splitIndex !== -1 && splitIndex > 0 && splitIndex < words.length) {
                    examName = words.slice(0, splitIndex).join(" ");
                    profName = words.slice(splitIndex).join(" ");
                } else {
                    examName = textBeforeYear;
                }

                // Fix text extraction bugs for multi-line subjects
                const upperName = examName.toUpperCase().trim();
                if (upperName === "ARCHITETTURA DEGLI") {
                    examName = "ARCHITETTURA DEGLI ELABORATORI";
                } else if (upperName === "PROGRAMMAZIONE OBJECT") {
                    examName = "PROGRAMMAZIONE OBJECT ORIENTED";
                } else if (upperName === "PROGRAMMAZIONESTRUT") {
                    examName = "PROGRAMMAZIONE STRUTTURATA E STRUTTURE DATI";
                } else if (upperName === "PROGRAMMAZIONE AND") {
                    examName = "PROGRAMMAZIONE E ALGORITMI";
                }
            } else {
                const capsMatch = currentExamInfo.match(/([A-ZÀ-Ú\']{4,}(?:\s+[A-ZÀ-Ú\']{2,})*)/g);
                if (capsMatch && capsMatch.length > 0) {
                    examName = capsMatch[capsMatch.length - 1];
                }
            }
            
            examName = examName.replace(/[\/\-\;]+$/, '').trim();

            let oraEsame = "N/D";
            let aulaEsame = "N/D";

            if (timeMatch) {
                oraEsame = timeMatch[0];
                const afterTime = appelloDetails.substring(timeMatch.index + timeMatch[0].length);
                aulaEsame = afterTime.replace(/^[\s\-]+/, '').trim() || "Non specificata";
            } else {
                const afterDate = appelloDetails.substring(appelloDetails.indexOf(dateStr) + dateStr.length);
                aulaEsame = afterDate.replace(/^[\s\-]+/, '').trim() || "Non specificata";
            }
            
            aulaEsame = aulaEsame.replace(/(\d{4}\/\d{4}).*$/, '').trim(); 
            aulaEsame = aulaEsame.replace(/;.*/, '').trim(); 

            const [day, month, year] = dateStr.split('-');
            const parsedDate = new Date(`${year}-${month}-${day}T00:00:00`);

            // Deduce year level from part / currentExamInfo
            let yearLevel = "Altro";
            const contextText = (currentExamInfo + " " + part).toUpperCase();
            if (contextText.includes("MAGISTRALE")) {
                yearLevel = "Magistrale";
            } else if (contextText.includes("1 ANNO") || contextText.includes("PRIMO ANNO") || contextText.includes("1° ANNO")) {
                yearLevel = "1° Anno";
            } else if (contextText.includes("2 ANNO") || contextText.includes("SECONDO ANNO") || contextText.includes("2° ANNO")) {
                yearLevel = "2° Anno";
            } else if (contextText.includes("3 ANNO") || contextText.includes("TERZO ANNO") || contextText.includes("3° ANNO")) {
                yearLevel = "3° Anno";
            }

            exams.push({
                id: Math.random().toString(36).substr(2, 9),
                examName: examName,
                profName: profName,
                dateStr: dateStr,
                ora: oraEsame,
                aula: aulaEsame,
                yearLevel: yearLevel,
                timestamp: parsedDate.getTime()
            });

            currentExamInfo = nextExamInfo;
        }

        exams.sort((a, b) => a.timestamp - b.timestamp);
        return exams;
    }

    function buildGroupedExams() {
        groupedExams = {};
        subjectYearMap = {};
        allExams.forEach(exam => {
            const subject = exam.examName;
            const prof = exam.profName;
            
            if (!groupedExams[subject]) {
                groupedExams[subject] = {};
            }
            if (!groupedExams[subject][prof]) {
                groupedExams[subject][prof] = [];
            }
            groupedExams[subject][prof].push(exam);

            if (!subjectYearMap[subject]) {
                subjectYearMap[subject] = new Set();
            }
            if (exam.yearLevel) {
                subjectYearMap[subject].add(exam.yearLevel);
            }
        });
    }

    // --- STATE MANAGEMENT ---
    function saveExam(exam) {
        savedExams.push(exam);
        savedExams.sort((a, b) => a.timestamp - b.timestamp);
        localStorage.setItem('calendarioPlusExams', JSON.stringify(savedExams));
        renderSavedExams();
    }

    function removeExam(id) {
        savedExams = savedExams.filter(e => e.id !== id);
        localStorage.setItem('calendarioPlusExams', JSON.stringify(savedExams));
        renderSavedExams();
        
        // Re-render appelli if the section is currently active and looking at the same prof
        const activeChip = profList.querySelector('.chip.active');
        if (activeChip && subjectInput.value) {
            selectProfessor(subjectInput.value, activeChip.textContent);
        }
    }

    function renderSavedExams() {
        savedExamsList.innerHTML = '';
        const now = new Date().getTime();

        const validExams = savedExams.filter(exam => {
            return (exam.timestamp + 86400000) >= now; 
        });

        if (validExams.length !== savedExams.length) {
            savedExams = validExams;
            localStorage.setItem('calendarioPlusExams', JSON.stringify(savedExams));
        }

        if (savedExams.length === 0) {
            savedExamsList.innerHTML = '<div class="empty-state fade-in"><span>📭</span> Nessun esame salvato.<br><span style="font-size: 1rem; margin-top:5px;">Cerca una materia per aggiungerla al tuo calendario!</span></div>';
            return;
        }

        savedExams.forEach(exam => {
            const diff = exam.timestamp - now;
            let countdownHtml = '';

            if (diff > 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                
                countdownHtml = `
                    <div class="countdown-box">
                        <div class="cd-item"><div class="num">${days}</div><div class="label">Giorni</div></div>
                        <div class="cd-item"><div class="num">${hours}</div><div class="label">Ore</div></div>
                    </div>
                `;
            } else {
                countdownHtml = `<p style="color: var(--success); font-weight: 600; margin: 10px 0;">Oggi è il giorno dell'esame! In bocca al lupo! 🍀</p>`;
            }

            const card = document.createElement('div');
            card.className = 'saved-exam-card fade-in';
            const badgeHtml = getBadgeHtml(exam.yearLevel);
            
            card.innerHTML = `
                ${badgeHtml}
                <h3>${exam.examName}</h3>
                <div class="info-grid">
                    <p><strong>Prof:</strong> ${exam.profName}</p>
                    <p><strong>Data:</strong> ${exam.dateStr}</p>
                    <p><strong>Ora:</strong> ${exam.ora}</p>
                    <p><strong>Aula:</strong> ${exam.aula}</p>
                </div>
                ${countdownHtml}
                <button class="btn btn-danger">Rimuovi</button>
            `;

            card.querySelector('button').addEventListener('click', () => removeExam(exam.id));
            savedExamsList.appendChild(card);
        });
    }

    // --- CONDIVIDI CON AMICI ---
    if (shareExamsBtn) {
        shareExamsBtn.addEventListener('click', async () => {
            if (savedExams.length === 0) {
                alert("Non hai ancora salvato nessun esame da condividere! Cerca una materia e salva almeno un appello.");
                return;
            }

            let shareText = "📚 I MIEI PROSSIMI ESAMI (CalendarioPLUS):\n\n";
            savedExams.forEach((exam, idx) => {
                const yr = exam.yearLevel && exam.yearLevel !== 'Altro' ? ` [${exam.yearLevel}]` : '';
                shareText += `${idx + 1}. 📖 ${exam.examName}${yr}\n`;
                shareText += `   📅 Data: ${exam.dateStr}`;
                if (exam.ora && exam.ora !== 'N/D') shareText += ` ore ${exam.ora}`;
                shareText += `\n   👨‍🏫 Prof: ${exam.profName}\n`;
                if (exam.aula && exam.aula !== 'Non specificata' && exam.aula !== 'N/D') {
                    shareText += `   📍 Aula: ${exam.aula}\n`;
                }
                shareText += `\n`;
            });
            shareText += "Organizzato con CalendarioPLUS ✨";

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'I miei esami - CalendarioPLUS',
                        text: shareText
                    });
                    return;
                } catch (err) {
                    // Finestra chiusa dall'utente o fallback
                }
            }

            // Fallback: Copia negli appunti
            navigator.clipboard.writeText(shareText).then(() => {
                alert("📋 Elenco esami copiato negli appunti! Ora puoi incollarlo su WhatsApp, Telegram o nei tuoi gruppi di studio.");
            }).catch(() => {
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
            });
        });
    }

    // --- SVUOTA TUTTO ---
    if (clearAllExamsBtn) {
        clearAllExamsBtn.addEventListener('click', () => {
            if (savedExams.length === 0) {
                alert("Nessun esame salvato da rimuovere.");
                return;
            }

            const confirmClear = confirm("⚠️ Sei sicuro di voler cancellare TUTTI gli esami salvati dal tuo calendario?");
            if (confirmClear) {
                savedExams = [];
                localStorage.setItem('calendarioPlusExams', JSON.stringify(savedExams));
                renderSavedExams();

                const activeChip = profList.querySelector('.chip.active');
                if (activeChip && subjectInput.value) {
                    selectProfessor(subjectInput.value, activeChip.textContent);
                }
            }
    }

    // --- SINCRONIZZAZIONE DISPOSITIVI (QR CODE & LINK) ---
    let currentSyncUrl = '';

    function encodeSyncData(data) {
        const compact = data.map(e => ({
            id: e.id,
            n: e.examName,
            p: e.profName,
            d: e.dateStr,
            o: e.ora,
            a: e.aula,
            y: e.yearLevel || '',
            t: e.timestamp,
            m: !!e.isManual
        }));
        return btoa(encodeURIComponent(JSON.stringify(compact)));
    }

    function decodeSyncData(encoded) {
        const compact = JSON.parse(decodeURIComponent(atob(encoded)));
        return compact.map(e => ({
            id: e.id || ('sync_' + Math.random().toString(36).substr(2, 9)),
            examName: e.n,
            profName: e.p,
            dateStr: e.d,
            ora: e.o,
            aula: e.a,
            yearLevel: e.y || 'Altro',
            timestamp: e.t,
            isManual: !!e.m
        }));
    }

    function openSyncModal() {
        if (savedExams.length === 0) {
            alert("Non hai ancora salvato nessun esame da sincronizzare! Salva prima almeno un esame.");
            return;
        }

        const encodedData = encodeSyncData(savedExams);
        currentSyncUrl = `${window.location.origin}${window.location.pathname}#sync=${encodedData}`;

        qrcodeContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(qrcodeContainer, {
                    text: currentSyncUrl,
                    width: 190,
                    height: 190,
                    colorDark: "#cc1c12",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (err) {
                renderFallbackQrCode();
            }
        } else {
            renderFallbackQrCode();
        }

        syncModal.classList.remove('hidden');
    }

    function renderFallbackQrCode() {
        qrcodeContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=cc1c12&data=${encodeURIComponent(currentSyncUrl)}`;
        img.alt = "QR Code di Sincronizzazione";
        qrcodeContainer.appendChild(img);
    }

    function closeSyncModal() {
        syncModal.classList.add('hidden');
    }

    if (syncExamsBtn) {
        syncExamsBtn.addEventListener('click', openSyncModal);
    }

    if (closeSyncModalBtn) {
        closeSyncModalBtn.addEventListener('click', closeSyncModal);
    }

    if (cancelSyncModalBtn) {
        cancelSyncModalBtn.addEventListener('click', closeSyncModal);
    }

    if (syncModal) {
        syncModal.addEventListener('click', (e) => {
            if (e.target === syncModal) {
                closeSyncModal();
            }
        });
    }

    if (copySyncLinkBtn) {
        copySyncLinkBtn.addEventListener('click', () => {
            if (!currentSyncUrl) return;
            navigator.clipboard.writeText(currentSyncUrl).then(() => {
                alert("📋 Link di sincronizzazione copiato! Incollalo su WhatsApp o invialo al tuo telefono.");
            }).catch(() => {
                prompt("Copia questo link di sincronizzazione per il tuo altro dispositivo:", currentSyncUrl);
            });
        });
    }

    function checkIncomingSync() {
        const hash = window.location.hash;
        const search = window.location.search;
        let syncParam = null;

        if (hash && hash.includes('sync=')) {
            syncParam = hash.split('sync=')[1];
        } else if (search && search.includes('sync=')) {
            const params = new URLSearchParams(search);
            syncParam = params.get('sync');
        }

        if (syncParam) {
            try {
                const importedExams = decodeSyncData(syncParam);
                if (Array.isArray(importedExams) && importedExams.length > 0) {
                    const shouldImport = savedExams.length === 0 || confirm(
                        `📲 Trovati ${importedExams.length} esami dal link di sincronizzazione!\n\nVuoi importarli nel tuo calendario?`
                    );

                    if (shouldImport) {
                        const merged = [...savedExams];
                        importedExams.forEach(newExam => {
                            if (!merged.some(e => e.examName === newExam.examName && e.dateStr === newExam.dateStr)) {
                                merged.push(newExam);
                            }
                        });
                        savedExams = merged;
                        savedExams.sort((a, b) => a.timestamp - b.timestamp);
                        localStorage.setItem('calendarioPlusExams', JSON.stringify(savedExams));
                        renderSavedExams();
                        alert(`✅ Sincronizzazione completata! ${importedExams.length} esami caricati sul dispositivo.`);
                        // Puliamo l'hash dall'URL per evitare richieste ripetute
                        history.replaceState(null, null, window.location.pathname);
                    }
                }
            } catch (err) {
                console.error("Errore durante l'importazione sincrona:", err);
            }
        }
    }
});
