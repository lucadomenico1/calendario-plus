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

    // Manual form elements
    const showManualFormBtn = document.getElementById('show-manual-form-btn');
    const manualExamForm = document.getElementById('manual-exam-form');
    const saveManualBtn = document.getElementById('save-manual-btn');
    const cancelManualBtn = document.getElementById('cancel-manual-btn');

    let allExams = []; 
    let groupedExams = {}; 
    let savedExams = JSON.parse(localStorage.getItem('calendarioPlusExams')) || [];

    // Initialize
    renderSavedExams();
    setInterval(renderSavedExams, 60000); 

    // Auto-load PDF on startup
    async function loadDatabase() {
        try {
            uploadStatus.textContent = 'Scaricamento e lettura del database in corso...';
            const response = await fetch('./ttPdf.pdf');
            if (!response.ok) throw new Error("PDF non trovato sul server.");
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
            uploadStatus.textContent = 'Errore durante l\'inizializzazione del database. Ricarica la pagina.';
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

    // Close autocomplete when clicking outside
    document.addEventListener("click", function (e) {
        if (e.target !== subjectInput && e.target !== autocompleteList) {
            autocompleteList.innerHTML = '';
        }
    });

    // --- NEW SEARCH LOGIC ---
    subjectInput.addEventListener('input', function() {
        const val = this.value;
        autocompleteList.innerHTML = '';
        profContainer.classList.add('hidden');
        appelliContainer.classList.add('hidden');
        
        if (!val) return;
        
        const subjects = Object.keys(groupedExams);
        const matches = subjects.filter(s => s.toLowerCase().includes(val.toLowerCase()));
        
        matches.slice(0, 10).forEach(match => { // Show max 10 suggestions
            const div = document.createElement('div');
            // Highlight the matching part
            const regex = new RegExp(`(${val})`, "gi");
            div.innerHTML = match.replace(regex, "<strong>$1</strong>");
            
            div.addEventListener('click', () => {
                subjectInput.value = match;
                autocompleteList.innerHTML = '';
                selectSubject(match);
            });
            autocompleteList.appendChild(div);
        });
    });

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
            
            const card = document.createElement('div');
            card.className = 'result-card fade-in';
            card.innerHTML = `
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

            exams.push({
                id: Math.random().toString(36).substr(2, 9),
                examName: examName,
                profName: profName,
                dateStr: dateStr,
                ora: oraEsame,
                aula: aulaEsame,
                timestamp: parsedDate.getTime()
            });

            currentExamInfo = nextExamInfo;
        }

        exams.sort((a, b) => a.timestamp - b.timestamp);
        return exams;
    }

    function buildGroupedExams() {
        groupedExams = {};
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
            card.innerHTML = `
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
});
