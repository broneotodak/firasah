// Global variables
let currentUser = null;
let selectedFile = null;
let person1File = null;
let person2File = null;
let analysisMode = 'summary'; // 'summary' or 'detailed'

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Set up demo user
    currentUser = {
        id: 'demo-' + Date.now(),
        email: 'demo@firasah.ai',
        name: 'Demo User'
    };
    
    // Set up event listeners
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.currentTarget.dataset.section;
            switchSection(section);
        });
    });
    
    // File upload
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    
    uploadArea.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            fileInput.click();
        }
    });
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
    
    // Analyze button
    document.getElementById('analyze-btn').addEventListener('click', analyzeWithWebhook);
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle-btn');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

// Theme toggle
function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle-btn');
    const icon = btn.querySelector('i');
    
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    } else {
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    }
}

// Analysis mode selection
function setAnalysisMode(mode) {
    analysisMode = mode;
    
    // Update button states
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    // Update labels based on language
    const language = document.getElementById('language-select')?.value || 'my';
    const labels = {
        my: { summary: 'Ringkasan Pantas', detailed: 'Analisis Penuh' },
        en: { summary: 'Quick Summary', detailed: 'Full Analysis' },
        id: { summary: 'Ringkasan Cepat', detailed: 'Analisis Lengkap' }
    };
    
    console.log(`Analysis mode set to: ${mode}`);
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.querySelector('i').className = 'fas fa-sun';
}

// Section Management
function switchSection(section) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');
}

// File Handling
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFile(file);
    }
}

function handleFile(file) {
    selectedFile = file;
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const preview = document.getElementById('preview-image');
        preview.src = e.target.result;
        preview.style.display = 'block';
        document.querySelector('.upload-content').style.display = 'none';
        document.getElementById('analyze-btn').style.display = 'flex';
    };
    
    reader.readAsDataURL(file);
}

// Convert file to base64
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// NEW: Webhook-based analysis (no timeout issues!)
async function analyzeWithWebhook() {
    if (!selectedFile) return;
    
    showLoading('Starting analysis...');
    
    try {
        const imageUrl = await fileToBase64(selectedFile);
        
        // Start the prediction
        const startResponse = await fetch('/.netlify/functions/analyze-image-webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageUrl })
        });

        if (!startResponse.ok) {
            const error = await startResponse.json();
            throw new Error(error.error || 'Failed to start analysis');
        }

        const { predictionId } = await startResponse.json();
        
        // Poll for results
        showLoading('Analyzing your image with detailed insights...');
        checkPredictionStatus(predictionId);
        
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
        
        // Fallback to direct method if webhook fails
        console.log('Falling back to direct analysis...');
        analyzeIndividual();
    }
}

// Check prediction status
async function checkPredictionStatus(predictionId) {
    try {
        const response = await fetch(`/.netlify/functions/check-prediction?id=${predictionId}`);
        const data = await response.json();
        
        // Handle face validation failure
        if (data.status === 'validation_failed') {
            hideLoading();
            showValidationError(data.error);
            return;
        }
        
        if (data.status === 'completed' && data.success) {
            // Get selected language for loading message
            const language = document.getElementById('language-select')?.value || 'my';
            const loadingMessages = {
                'my': 'Menterjemah ke Bahasa Melayu dan mentafsir karakter...',
                'en': 'Translating and interpreting character...',
                'id': 'Menerjemahkan dan menafsirkan karakter...'
            };
            showLoading(loadingMessages[language] || loadingMessages['my']);
            await getKitabFirasatInterpretation(data.analysis);
        } else if (data.status === 'processing' || data.status === 'starting') {
            // Check again in 2 seconds
            setTimeout(() => checkPredictionStatus(predictionId), 2000);
        } else if (data.status === 'failed') {
            throw new Error(data.error || 'Analysis failed');
        }
        
    } catch (error) {
        console.error('Error checking status:', error);
        hideLoading();
        alert('Error checking analysis status. Trying direct method...');
        analyzeIndividual();
    }
}

// Show validation error to user
function showValidationError(errorMessage) {
    const language = document.getElementById('language-select')?.value || 'my';
    
    const errorMessages = {
        'my': {
            title: '⚠️ Gambar Tidak Sah',
            subtitle: 'Sila muat naik gambar wajah manusia yang jelas',
            reasons: {
                'animal': 'Ini kelihatan seperti gambar haiwan, bukan manusia',
                'cartoon': 'Ini kelihatan seperti kartun atau ilustrasi',
                'blurry': 'Gambar terlalu kabur untuk dianalisis',
                'no_face': 'Tiada wajah manusia dikesan dalam gambar',
                'multiple': 'Beberapa wajah dikesan - sila muat naik satu wajah sahaja',
                'default': errorMessage
            },
            tryAgain: 'Cuba Lagi'
        },
        'en': {
            title: '⚠️ Invalid Image',
            subtitle: 'Please upload a clear human face photo',
            reasons: {
                'animal': 'This appears to be an animal, not a human',
                'cartoon': 'This appears to be a cartoon or illustration',
                'blurry': 'Image is too blurry to analyze',
                'no_face': 'No human face detected in image',
                'multiple': 'Multiple faces detected - please upload single face',
                'default': errorMessage
            },
            tryAgain: 'Try Again'
        },
        'id': {
            title: '⚠️ Gambar Tidak Valid',
            subtitle: 'Silakan unggah foto wajah manusia yang jelas',
            reasons: {
                'animal': 'Ini tampak seperti gambar hewan, bukan manusia',
                'cartoon': 'Ini tampak seperti kartun atau ilustrasi',
                'blurry': 'Gambar terlalu buram untuk dianalisis',
                'no_face': 'Tidak ada wajah manusia terdeteksi dalam gambar',
                'multiple': 'Beberapa wajah terdeteksi - silakan unggah satu wajah saja',
                'default': errorMessage
            },
            tryAgain: 'Coba Lagi'
        }
    };
    
    const lang = errorMessages[language] || errorMessages['my'];
    
    // Determine error type from message
    let reasonKey = 'default';
    const lowerError = errorMessage.toLowerCase();
    if (lowerError.includes('animal') || lowerError.includes('cat') || lowerError.includes('dog')) reasonKey = 'animal';
    else if (lowerError.includes('cartoon') || lowerError.includes('illustration')) reasonKey = 'cartoon';
    else if (lowerError.includes('blurry') || lowerError.includes('blur')) reasonKey = 'blurry';
    else if (lowerError.includes('no') && lowerError.includes('face')) reasonKey = 'no_face';
    else if (lowerError.includes('multiple')) reasonKey = 'multiple';
    
    const reason = lang.reasons[reasonKey];
    
    // Show error in results area
    const resultsDiv = document.getElementById('analysis-results');
    const resultsContent = document.getElementById('results-content');
    
    resultsContent.innerHTML = `
        <div class="validation-error">
            <div class="error-icon">🚫</div>
            <h3>${lang.title}</h3>
            <p class="error-reason">${reason}</p>
            <p class="error-subtitle">${lang.subtitle}</p>
            <button onclick="resetUpload()" class="try-again-btn">${lang.tryAgain}</button>
        </div>
    `;
    resultsDiv.style.display = 'block';
    scrollToResults(resultsDiv);
}

// Reset upload for retry
function resetUpload() {
    selectedFile = null;
    const preview = document.getElementById('preview');
    const placeholder = document.getElementById('placeholder');
    const resultsDiv = document.getElementById('analysis-results');
    
    if (preview) preview.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
    if (resultsDiv) resultsDiv.style.display = 'none';
    
    // Clear file input
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
}

// Get Kitab Firasat interpretation using background function + polling
async function getKitabFirasatInterpretation(llavaAnalysis) {
    try {
        const language = document.getElementById('language-select')?.value || 'my';
        const jobId = `frs_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        updateLoadingText('Memulakan tafsiran karakter...');
        
        // Start background job
        const startResponse = await fetch('/.netlify/functions/interpret-background', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ llavaAnalysis, language, jobId, mode: analysisMode })
        });
        
        // Background function returns 202, but we also handle other cases
        if (!startResponse.ok && startResponse.status !== 202) {
            throw new Error('Failed to start interpretation');
        }
        
        // Poll for results
        updateLoadingText('Menganalisis personaliti...');
        const result = await pollInterpretationResult(jobId);
        
        if (result.status === 'completed') {
            hideLoading();
            displayKitabFirasatResults(result.interpretation, result.source, result.langConfig);
        } else if (result.status === 'failed') {
            throw new Error(result.error || 'Interpretation failed');
        }
        
    } catch (error) {
        console.error('Error getting interpretation:', error);
        hideLoading();
        // Fallback to showing original English analysis
        displayResults(llavaAnalysis);
    }
}

// Poll for interpretation result
async function pollInterpretationResult(jobId, maxAttempts = 60, interval = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetch(`/.netlify/functions/check-interpretation?id=${jobId}`);
            const data = await response.json();
            
            if (data.status === 'completed' || data.status === 'failed') {
                return data;
            }
            
            // Still processing - wait and retry
            if (attempt % 5 === 0) {
                updateLoadingText('Mentafsir ciri-ciri wajah...');
            }
            await new Promise(resolve => setTimeout(resolve, interval));
            
        } catch (error) {
            console.error('Poll error:', error);
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    return { status: 'failed', error: 'Interpretation timeout' };
}

// Update loading text helper
function updateLoadingText(text) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = text;
}

// OLD: Direct analysis (might timeout)
async function analyzeIndividual() {
    if (!selectedFile) return;
    
    showLoading('Analyzing image (direct method)...');
    
    try {
        const imageUrl = await fileToBase64(selectedFile);
        
        const response = await fetch('/.netlify/functions/analyze-image-replicate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageUrl })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Analysis failed');
        }

        const data = await response.json();
        
        hideLoading();
        displayResults(data.analysis);
        
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
        alert('Error analyzing image: ' + error.message);
    }
}

// Display results  
function displayResults(analysis) {
    const resultsDiv = document.getElementById('analysis-results');
    const resultsContent = document.getElementById('results-content');
    
    // Classical Firasah features mapping with icons
    const featureIcons = {
        'FOREHEAD': '👁️',
        'EYEBROWS': '🤨', 
        'EYES': '👀',
        'NOSE': '👃',
        'LIPS & MOUTH': '👄',
        'JAWLINE & CHIN': '🗿',
        'CHEEKBONES': '😊',
        'EARS': '👂',
        'FACE SHAPE': '🎭',
        'HAIRLINE': '💇'
    };
    
    // Format the analysis into sections based on Kitab Firasat structure
    let formattedHTML = '<h3 style="text-align: center; color: #9D4EDD; margin-bottom: 20px;">Classical Physiognomy Analysis (Ilmu Firasat)</h3>';
    
    // Split by numbered sections (1., 2., etc.)
    const sections = analysis.split(/(?=\d+\.\s+[A-Z])/);
    
    sections.forEach((section) => {
        if (section.trim()) {
            // Extract the feature name with Arabic term
            const match = section.match(/^\d+\.\s+([A-Z\s&]+)\s*\(([^)]+)\):(.*)$/s);
            
            if (match) {
                const featureName = match[1].trim();
                const arabicName = match[2].trim();
                const description = match[3].trim();
                const icon = featureIcons[featureName.toUpperCase()] || '📝';
                
                formattedHTML += `
                    <div class="result-card" style="margin-bottom: 15px; padding: 20px; background: rgba(157, 78, 221, 0.1); border-radius: 10px; border-left: 4px solid #9D4EDD;">
                        <h4 style="color: #C77DFF; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5em;">${icon}</span>
                            <span>${featureName}</span>
                            <span style="color: #E0AAFF; font-style: italic; font-size: 0.9em;">(${arabicName})</span>
                        </h4>
                        <div class="content" style="color: #eee; line-height: 1.6;">
                            <p>${description}</p>
                        </div>
                    </div>
                `;
            } else {
                formattedHTML += `
                    <div class="result-card" style="margin-bottom: 15px; padding: 20px;">
                        <div class="content"><p>${section.trim()}</p></div>
                    </div>
                `;
            }
        }
    });
    
    formattedHTML += `
        <div style="margin-top: 30px; padding: 20px; background: rgba(157, 78, 221, 0.05); border-radius: 10px; text-align: center;">
            <p style="color: #C77DFF; font-style: italic;">
                Analysis based on classical Islamic physiognomy (Kitab Firasat) principles.
            </p>
        </div>
    `;
    
    resultsContent.innerHTML = formattedHTML;
    resultsDiv.style.display = 'block';
    
    // Auto-scroll to results with smooth animation
    scrollToResults(resultsDiv);
}

// Display Kitab Firasat Results with language support
function displayKitabFirasatResults(interpretation, source, langConfig) {
    const resultsDiv = document.getElementById('analysis-results');
    const resultsContent = document.getElementById('results-content');
    
    // Default labels if langConfig not provided
    const labels = langConfig || {
        summaryLabel: 'Character Summary',
        positiveLabel: 'Positive Traits',
        negativeLabel: 'Traits to Watch',
        personalityLabel: 'Personality Type'
    };
    
    const featureIcons = {
        'dahi': '👁️', 'kening': '🤨', 'mata': '👀', 'hidung': '👃',
        'mulut_bibir': '👄', 'bentuk_wajah': '🎭', 'rahang_dagu': '🗿',
        'pipi': '😊', 'telinga': '👂', 'garis_rambut': '💇'
    };
    
    const featureNames = {
        'dahi': 'Dahi / Forehead', 'kening': 'Kening / Eyebrows', 'mata': 'Mata / Eyes', 
        'hidung': 'Hidung / Nose', 'mulut_bibir': 'Mulut & Bibir / Lips & Mouth', 
        'bentuk_wajah': 'Bentuk Wajah / Face Shape', 'rahang_dagu': 'Rahang & Dagu / Jawline & Chin', 
        'pipi': 'Pipi / Cheeks', 'telinga': 'Telinga / Ears', 'garis_rambut': 'Garis Rambut / Hairline'
    };

    let html = `
        <div class="firasah-header">
            <h3>📖 Firasah Analysis <span class="arabic-term">(${source.arabic || 'الفراسة'})</span></h3>
            <p class="source">${source.title} - ${source.author} (${source.period})</p>
        </div>
    `;
    
    // Character Summary Card
    if (interpretation.character_interpretation) {
        const ci = interpretation.character_interpretation;
        html += `
            <div class="character-summary-card">
                <h4>🎯 ${labels.summaryLabel || 'Character Summary'}</h4>
                <p class="summary-text">${ci.overall_summary || ''}</p>
                
                <div class="traits-container">
                    <div class="traits-box-positive">
                        <h5>✨ ${labels.positiveLabel || 'Positive Traits'}</h5>
                        <ul>
                            ${(ci.positive_traits || []).map(t => `<li>${t}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="traits-box-negative">
                        <h5>⚠️ ${labels.negativeLabel || 'Traits to Watch'}</h5>
                        <ul>
                            ${(ci.negative_traits || []).map(t => `<li>${t}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                
                <p class="personality-type">
                    <strong>${labels.personalityLabel || 'Personality Type'}:</strong> ${ci.personality_type || ''}
                </p>
            </div>
        `;
    }
    
    // Feature Cards
    html += '<h4 class="section-header">📋 Analisis Ciri-ciri Wajah</h4>';
    
    if (interpretation.translated_features) {
        for (const [key, feature] of Object.entries(interpretation.translated_features)) {
            const icon = featureIcons[key] || '📝';
            const name = featureNames[key] || key;
            const arabicTerm = feature.arabic || '';
            html += `
                <div class="feature-card">
                    <h5>
                        <span style="font-size: 1.3em;">${icon}</span> 
                        <span>${name}</span>
                        ${arabicTerm ? `<span class="arabic-term">(${arabicTerm})</span>` : ''}
                    </h5>
                    <p>${feature.description || ''}</p>
                </div>
            `;
        }
    }
    
    // Kitab References
    if (interpretation.kitab_references && interpretation.kitab_references.length > 0) {
        html += `
            <div class="kitab-references">
                <h4>📚 Rujukan Kitab Firasat</h4>
                ${interpretation.kitab_references.map(ref => `
                    <div class="kitab-reference-item">
                        <strong>${ref.feature || ''} ${ref.arabic_term ? `<span class="arabic">(${ref.arabic_term})</span>` : ''}</strong>
                        <p class="quote">"${ref.quote || ''}"</p>
                        ${ref.source ? `<small class="source">— ${ref.source}</small>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Disclaimer
    html += `
        <div class="firasah-disclaimer">
            <p>⚠️ ${interpretation.disclaimer || 'Tafsiran ini berdasarkan ilmu firasat klasik dan bukan ramalan mutlak. Karakter seseorang boleh berubah dan dipengaruhi oleh banyak faktor.'}</p>
        </div>
    `;
    
    // Share buttons
    const shareLabels = {
        my: { share: 'Kongsi Hasil', copy: 'Salin Pautan' },
        en: { share: 'Share Results', copy: 'Copy Link' },
        id: { share: 'Bagikan Hasil', copy: 'Salin Tautan' }
    };
    const shareLang = shareLabels[document.getElementById('language-select')?.value] || shareLabels.my;
    
    // Store interpretation for sharing
    window.currentInterpretation = interpretation;
    
    html += `
        <div class="share-container">
            <button class="share-btn instagram" onclick="shareToInstagram()">
                <span class="icon">📸</span> Instagram
            </button>
            <button class="share-btn whatsapp" onclick="shareToWhatsApp()">
                <span class="icon">💬</span> WhatsApp
            </button>
            <button class="share-btn twitter" onclick="shareToTwitter()">
                <span class="icon">𝕏</span> Twitter/X
            </button>
            <button class="share-btn copy-link" onclick="copyShareLink()">
                <span class="icon">🔗</span> ${shareLang.copy}
            </button>
        </div>
    `;
    
    resultsContent.innerHTML = html;
    resultsDiv.style.display = 'block';
    
    // Auto-scroll to results with smooth animation
    scrollToResults(resultsDiv);
}

// Auto-scroll to results with notification
function scrollToResults(resultsDiv) {
    // Small delay to ensure DOM is updated
    setTimeout(() => {
        // Show a brief "Results Ready" notification
        showResultsNotification();
        
        // Smooth scroll to results
        resultsDiv.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start'
        });
        
        // Add a highlight animation to the results
        resultsDiv.classList.add('results-highlight');
        setTimeout(() => {
            resultsDiv.classList.remove('results-highlight');
        }, 2000);
    }, 300);
}

// Show notification that results are ready
function showResultsNotification() {
    // Remove existing notification if any
    const existing = document.querySelector('.results-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'results-notification';
    notification.innerHTML = `
        <span class="notification-icon">✨</span>
        <span class="notification-text">Analisis selesai! Lihat hasil di bawah</span>
        <span class="notification-arrow">↓</span>
    `;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after scroll completes
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}

// Loading states
function showLoading(text) {
    const modal = document.getElementById('loading-modal');
    const loadingText = document.getElementById('loading-text');
    loadingText.textContent = text;
    modal.style.display = 'flex';
    
    // Show scanning overlay on image
    const scanOverlay = document.getElementById('scan-overlay');
    const scanText = document.getElementById('scan-text');
    if (scanOverlay) {
        scanOverlay.style.display = 'flex';
        
        // Update scan text based on language
        if (scanText) {
            const language = document.getElementById('language-select')?.value || 'my';
            const scanMessages = {
                'my': 'Menganalisis ciri-ciri wajah...',
                'en': 'Analyzing facial features...',
                'id': 'Menganalisis ciri-ciri wajah...'
            };
            scanText.textContent = scanMessages[language] || scanMessages['en'];
        }
    }
}

function hideLoading() {
    document.getElementById('loading-modal').style.display = 'none';
    
    // Hide scanning overlay
    const scanOverlay = document.getElementById('scan-overlay');
    if (scanOverlay) {
        scanOverlay.style.display = 'none';
    }
}

// Export function
function exportAnalysisAsJSON() {
    const results = document.getElementById('results-content').innerText;
    const data = {
        timestamp: new Date().toISOString(),
        analysis: results,
        model: 'Replicate LLaVA-13B'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firasah-analysis-${Date.now()}.json`;
    a.click();
}

// ============================================
// SOCIAL SHARING FUNCTIONS
// ============================================

// Generate share text from interpretation
function generateShareText() {
    const interpretation = window.currentInterpretation;
    if (!interpretation || !interpretation.character_interpretation) {
        return 'Lihat analisis wajah saya berdasarkan Kitab Firasat! 🔮';
    }
    
    const ci = interpretation.character_interpretation;
    const personality = ci.personality_type || '';
    const topTrait = ci.positive_traits?.[0] || '';
    
    const language = document.getElementById('language-select')?.value || 'my';
    
    const templates = {
        my: `🔮 Analisis Firasah Saya:\n\n✨ Personaliti: ${personality}\n💫 Kekuatan: ${topTrait}\n\nCuba analisis wajah anda di:`,
        en: `🔮 My Firasah Analysis:\n\n✨ Personality: ${personality}\n💫 Strength: ${topTrait}\n\nTry your face analysis at:`,
        id: `🔮 Analisis Firasah Saya:\n\n✨ Kepribadian: ${personality}\n💫 Kekuatan: ${topTrait}\n\nCoba analisis wajah anda di:`
    };
    
    return templates[language] || templates.my;
}

// Share to Instagram (generates downloadable story card)
async function shareToInstagram() {
    const interpretation = window.currentInterpretation;
    if (!interpretation || !interpretation.character_interpretation) {
        showToast('⚠️ Tiada hasil untuk dikongsi', 'error');
        return;
    }
    
    showToast('🎨 Menjana kad story...', 'default');
    
    try {
        const cardDataUrl = await generateStoryCard(interpretation);
        showInstagramModal(cardDataUrl);
    } catch (error) {
        console.error('Error generating card:', error);
        showToast('❌ Gagal menjana kad', 'error');
    }
}

// Generate Instagram Story Card (1080x1920)
async function generateStoryCard(interpretation) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f0f23');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);
    
    // Decorative elements
    ctx.fillStyle = 'rgba(157, 78, 221, 0.1)';
    ctx.beginPath();
    ctx.arc(900, 200, 300, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(180, 1700, 250, 0, Math.PI * 2);
    ctx.fill();
    
    // Header
    ctx.fillStyle = '#C77DFF';
    ctx.font = 'bold 60px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔮 Firasah AI', 540, 150);
    
    ctx.fillStyle = '#888';
    ctx.font = '30px Inter, sans-serif';
    ctx.fillText('Analisis Wajah Berdasarkan Kitab Firasat', 540, 210);
    
    const ci = interpretation.character_interpretation;
    
    // Personality Type Box
    ctx.fillStyle = 'rgba(157, 78, 221, 0.2)';
    roundRect(ctx, 60, 280, 960, 120, 20);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillText('🎭 ' + (ci.personality_type || 'Personaliti Unik'), 540, 355);
    
    // Summary
    ctx.fillStyle = '#ddd';
    ctx.font = '28px Inter, sans-serif';
    const summary = ci.overall_summary || '';
    const summaryLines = wrapText(ctx, summary, 900);
    let y = 480;
    summaryLines.slice(0, 6).forEach(line => {
        ctx.fillText(line, 540, y);
        y += 45;
    });
    
    // Positive Traits Box
    y += 40;
    ctx.fillStyle = 'rgba(76, 175, 80, 0.15)';
    roundRect(ctx, 60, y, 960, 380, 20);
    ctx.fill();
    
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✨ Sifat Positif', 100, y + 50);
    
    ctx.fillStyle = '#ccc';
    ctx.font = '26px Inter, sans-serif';
    const positives = ci.positive_traits || [];
    positives.slice(0, 5).forEach((trait, i) => {
        const shortTrait = trait.length > 50 ? trait.substring(0, 47) + '...' : trait;
        ctx.fillText('• ' + shortTrait, 100, y + 100 + (i * 55));
    });
    
    // Negative Traits Box
    y += 420;
    ctx.fillStyle = 'rgba(255, 152, 0, 0.15)';
    roundRect(ctx, 60, y, 960, 280, 20);
    ctx.fill();
    
    ctx.fillStyle = '#FF9800';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillText('⚠️ Perlu Diperhatikan', 100, y + 50);
    
    ctx.fillStyle = '#ccc';
    ctx.font = '26px Inter, sans-serif';
    const negatives = ci.negative_traits || [];
    negatives.slice(0, 3).forEach((trait, i) => {
        const shortTrait = trait.length > 50 ? trait.substring(0, 47) + '...' : trait;
        ctx.fillText('• ' + shortTrait, 100, y + 100 + (i * 55));
    });
    
    // Footer CTA
    ctx.fillStyle = 'rgba(157, 78, 221, 0.3)';
    roundRect(ctx, 60, 1680, 960, 180, 20);
    ctx.fill();
    
    ctx.fillStyle = '#C77DFF';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌐 firasah.neotodak.com', 540, 1750);
    
    ctx.fillStyle = '#888';
    ctx.font = '28px Inter, sans-serif';
    ctx.fillText('Cuba analisis wajah anda!', 540, 1810);
    
    return canvas.toDataURL('image/png');
}

// Helper: Rounded rectangle
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Helper: Wrap text to lines
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });
    
    if (currentLine) lines.push(currentLine);
    return lines;
}

// Show Instagram modal with generated card
function showInstagramModal(cardDataUrl) {
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.id = 'share-modal';
    
    const language = document.getElementById('language-select')?.value || 'my';
    const labels = {
        my: {
            title: '📸 Kongsi ke Instagram Story',
            download: '💾 Muat Turun Kad',
            instruction: 'Muat turun kad, kemudian kongsi ke Instagram Story anda!',
            close: 'Tutup'
        },
        en: {
            title: '📸 Share to Instagram Story',
            download: '💾 Download Card',
            instruction: 'Download the card, then share to your Instagram Story!',
            close: 'Close'
        },
        id: {
            title: '📸 Bagikan ke Instagram Story',
            download: '💾 Unduh Kartu',
            instruction: 'Unduh kartu, lalu bagikan ke Instagram Story anda!',
            close: 'Tutup'
        }
    };
    const lang = labels[language] || labels.my;
    
    modal.innerHTML = `
        <div class="share-modal-content instagram-card-modal">
            <h3>${lang.title}</h3>
            <div class="card-preview">
                <img src="${cardDataUrl}" alt="Firasah Story Card" />
            </div>
            <p class="instruction">${lang.instruction}</p>
            <div class="modal-buttons">
                <button class="share-btn instagram" onclick="downloadStoryCard('${cardDataUrl}')">
                    ${lang.download}
                </button>
                <button class="close-modal" onclick="closeShareModal()">${lang.close}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeShareModal();
    });
}

// Download the story card
function downloadStoryCard(dataUrl) {
    const link = document.createElement('a');
    link.download = `firasah-story-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    showToast('✅ Kad dimuat turun!', 'success');
}

// Share to WhatsApp
function shareToWhatsApp() {
    const shareText = generateShareText();
    const url = 'https://firasah.neotodak.com';
    const fullText = encodeURIComponent(`${shareText}\n${url}`);
    
    window.open(`https://wa.me/?text=${fullText}`, '_blank');
}

// Share to Twitter/X
function shareToTwitter() {
    const shareText = generateShareText();
    const url = 'https://firasah.neotodak.com';
    const fullText = encodeURIComponent(`${shareText}`);
    const encodedUrl = encodeURIComponent(url);
    
    window.open(`https://twitter.com/intent/tweet?text=${fullText}&url=${encodedUrl}`, '_blank');
}

// Copy share link
function copyShareLink() {
    const url = 'https://firasah.neotodak.com';
    
    navigator.clipboard.writeText(url).then(() => {
        showToast('✅ Pautan disalin!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('✅ Pautan disalin!', 'success');
    });
}

// Show share modal (for Instagram)
function showShareModal(platform, text, url) {
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.id = 'share-modal';
    
    const language = document.getElementById('language-select')?.value || 'my';
    const labels = {
        my: {
            title: '📸 Kongsi ke Instagram',
            step1: '1. Screenshot hasil analisis anda',
            step2: '2. Buka Instagram Story',
            step3: '3. Tambah gambar dan link:',
            close: 'Tutup'
        },
        en: {
            title: '📸 Share to Instagram',
            step1: '1. Screenshot your analysis results',
            step2: '2. Open Instagram Story',
            step3: '3. Add image and link:',
            close: 'Close'
        },
        id: {
            title: '📸 Bagikan ke Instagram',
            step1: '1. Screenshot hasil analisis anda',
            step2: '2. Buka Instagram Story',
            step3: '3. Tambahkan gambar dan link:',
            close: 'Tutup'
        }
    };
    const lang = labels[language] || labels.my;
    
    modal.innerHTML = `
        <div class="share-modal-content">
            <h3>${lang.title}</h3>
            <div class="share-steps">
                <p>${lang.step1}</p>
                <p>${lang.step2}</p>
                <p>${lang.step3}</p>
                <div class="share-preview">
                    <strong>firasah.neotodak.com</strong>
                    <p style="font-size: 0.9em; margin-top: 10px;">🔮 Analisis Wajah Berdasarkan Kitab Firasat</p>
                </div>
            </div>
            <button class="share-btn copy-link" onclick="copyShareLink(); closeShareModal();">
                <span class="icon">🔗</span> Salin Pautan
            </button>
            <button class="close-modal" onclick="closeShareModal()">${lang.close}</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Animate in
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeShareModal();
    });
}

// Close share modal
function closeShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// Show toast notification
function showToast(message, type = 'default') {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
