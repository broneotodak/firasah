// Global variables
let currentUser = null;
let selectedFile = null;
let person1File = null;
let person2File = null;

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
        
        if (data.status === 'completed' && data.success) {
            // Now get the Kitab Firasat interpretation
            showLoading('Menterjemah ke Bahasa Melayu dan mentafsir karakter...');
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

// Get Kitab Firasat interpretation from OpenAI
async function getKitabFirasatInterpretation(llavaAnalysis) {
    try {
        // Get selected language
        const language = document.getElementById('language-select')?.value || 'my';
        
        const response = await fetch('/.netlify/functions/interpret-character', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ llavaAnalysis, language })
        });
        
        if (!response.ok) {
            const error = await response.json();
            console.error('Interpretation error:', error);
            // Fallback to showing original English analysis
            hideLoading();
            displayResults(llavaAnalysis);
            return;
        }
        
        const data = await response.json();
        hideLoading();
        displayKitabFirasatResults(data.interpretation, data.source, data.langConfig);
        
    } catch (error) {
        console.error('Error getting interpretation:', error);
        hideLoading();
        // Fallback to showing original English analysis
        displayResults(llavaAnalysis);
    }
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
        <div style="text-align: center; margin-bottom: 25px;">
            <h3 style="color: #9D4EDD; margin-bottom: 5px;">📖 Firasah Analysis</h3>
            <p style="color: #E0AAFF; font-size: 0.9em;">
                ${source.title} - ${source.author} (${source.period})
            </p>
        </div>
    `;
    
    // Character Summary Card
    if (interpretation.character_interpretation) {
        const ci = interpretation.character_interpretation;
        html += `
            <div style="background: linear-gradient(135deg, rgba(157,78,221,0.2), rgba(199,125,255,0.1)); 
                        padding: 25px; border-radius: 15px; margin-bottom: 25px; border: 1px solid rgba(157,78,221,0.3);">
                <h4 style="color: #C77DFF; margin-bottom: 15px;">🎯 ${labels.summaryLabel}</h4>
                <p style="color: #fff; line-height: 1.8; margin-bottom: 20px; font-size: 1.05em;">${ci.overall_summary}</p>
                
                <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 15px;">
                    <div style="flex: 1; min-width: 250px; background: rgba(76,175,80,0.1); padding: 15px; border-radius: 10px;">
                        <h5 style="color: #4CAF50; margin-bottom: 12px;">✨ ${labels.positiveLabel}</h5>
                        <ul style="color: #eee; margin: 0; padding-left: 20px; line-height: 1.8;">
                            ${ci.positive_traits.map(t => `<li>${t}</li>`).join('')}
                        </ul>
                    </div>
                    <div style="flex: 1; min-width: 250px; background: rgba(255,152,0,0.1); padding: 15px; border-radius: 10px;">
                        <h5 style="color: #FF9800; margin-bottom: 12px;">⚠️ ${labels.negativeLabel}</h5>
                        <ul style="color: #eee; margin: 0; padding-left: 20px; line-height: 1.8;">
                            ${ci.negative_traits.map(t => `<li>${t}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                
                <p style="color: #E0AAFF; font-style: italic; background: rgba(157,78,221,0.1); padding: 10px 15px; border-radius: 8px;">
                    <strong>${labels.personalityLabel}:</strong> ${ci.personality_type}
                </p>
            </div>
        `;
    }
    
    // Feature Cards
    html += '<h4 style="color: #C77DFF; margin: 20px 0 15px;">📋 Analisis Ciri-ciri Wajah</h4>';
    
    if (interpretation.translated_features) {
        for (const [key, feature] of Object.entries(interpretation.translated_features)) {
            const icon = featureIcons[key] || '📝';
            const name = featureNames[key] || key;
            html += `
                <div class="result-card" style="margin-bottom: 12px; padding: 18px; 
                     background: rgba(157, 78, 221, 0.1); border-radius: 10px; border-left: 4px solid #9D4EDD;">
                    <h5 style="color: #C77DFF; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.3em;">${icon}</span> ${name}
                    </h5>
                    <p style="color: #fff; line-height: 1.6;">${feature.description}</p>
                </div>
            `;
        }
    }
    
    // Kitab References
    if (interpretation.kitab_references && interpretation.kitab_references.length > 0) {
        html += `
            <div style="margin-top: 25px; padding: 20px; background: rgba(157, 78, 221, 0.05); border-radius: 10px;">
                <h4 style="color: #C77DFF; margin-bottom: 15px;">📚 Rujukan Kitab Firasat</h4>
                ${interpretation.kitab_references.map(ref => `
                    <div style="margin-bottom: 12px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                        <strong style="color: #E0AAFF;">${ref.feature}:</strong>
                        <p style="color: #ccc; font-style: italic; margin: 5px 0;">"${ref.quote}"</p>
                        <small style="color: #888;">— ${ref.source}</small>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Disclaimer
    html += `
        <div style="margin-top: 25px; padding: 15px; background: rgba(255,152,0,0.1); 
                    border-radius: 10px; border-left: 4px solid #FF9800; text-align: center;">
            <p style="color: #FFB74D; font-size: 0.9em;">
                ⚠️ ${interpretation.disclaimer || 'Tafsiran ini berdasarkan ilmu firasat klasik dan bukan ramalan mutlak. Karakter seseorang boleh berubah dan dipengaruhi oleh banyak faktor.'}
            </p>
        </div>
    `;
    
    resultsContent.innerHTML = html;
    resultsDiv.style.display = 'block';
}

// Loading states
function showLoading(text) {
    const modal = document.getElementById('loading-modal');
    const loadingText = document.getElementById('loading-text');
    loadingText.textContent = text;
    modal.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-modal').style.display = 'none';
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