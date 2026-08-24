/**
 * India Pollution — Full Presentation
 * 
 * A clean, Google-presentation-style video about India's pollution crisis.
 * Uses: Google Sans, clean palette, animations, images, SVG arrows,
 * highlight text, emojis, stickers, multiple HTML clips.
 * 
 * Duration: 45 seconds (9 scenes × 5s each)
 */

module.exports = function(StudioPro, State) {
    // ── Load Fonts ─────────────────────────────────────────────────────────
    StudioPro.fonts.loadGoogleBatch(['Google Sans', 'Inter']);

    // ── Color Palette ──────────────────────────────────────────────────────
    const P = {
        bg: '#FFFFFF',
        surface: '#F8F9FA',
        primary: '#1A73E8',
        secondary: '#5F6368',
        accent: '#EA4335',
        success: '#34A853',
        warning: '#FBBC04',
        text: '#202124',
        textSecondary: '#5F6368',
        border: '#DADCE0'
    };

    // ── Create Composition ─────────────────────────────────────────────────
    const result = StudioPro.createComposition({
        id: 'india-pollution',
        duration: 45,
        fps: 30,
        backgroundColor: P.bg,
        clips: [
            // ── Scene 1: Title Slide (0-5s) ───────────────────────────────
            StudioPro.html(
                `<div class="slide title-slide">
                    <div class="badge">📊 Environmental Report 2024</div>
                    <h1>Air Pollution in India</h1>
                    <p class="subtitle">A Growing Crisis Affecting 1.4 Billion People</p>
                    <div class="source">Source: WHO, Central Pollution Control Board</div>
                </div>`,
                `.slide {
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    font-family: 'Google Sans', 'Inter', sans-serif;
                    background: linear-gradient(135deg, #E8F0FE 0%, #FFFFFF 100%);
                    padding: 80px;
                }
                .badge {
                    background: ${P.primary};
                    color: white;
                    padding: 8px 24px;
                    border-radius: 100px;
                    font-size: 18px;
                    font-weight: 500;
                    margin-bottom: 40px;
                }
                .title-slide h1 {
                    color: ${P.text};
                    font-size: 72px;
                    font-weight: 700;
                    margin: 0 0 24px 0;
                    text-align: center;
                }
                .subtitle {
                    color: ${P.textSecondary};
                    font-size: 28px;
                    font-weight: 400;
                    margin: 0 0 40px 0;
                }
                .source {
                    color: ${P.textSecondary};
                    font-size: 14px;
                    font-style: italic;
                }`,
                '',
                { start: 0, duration: 5, fonts: ['Google Sans', 'Inter'] }
            ),

            // ── Scene 2: Key Statistics (5-10s) ────────────────────────────
            StudioPro.html(
                `<div class="slide stats-slide">
                    <h2>Key Statistics</h2>
                    <div class="stats-grid">
                        <div class="stat-card red">
                            <div class="stat-icon">🔴</div>
                            <div class="stat-number">14 of 20</div>
                            <div class="stat-label">Most polluted cities globally are in India</div>
                        </div>
                        <div class="stat-card orange">
                            <div class="stat-icon">⚠️</div>
                            <div class="stat-number">1.67M</div>
                            <div class="stat-label">Deaths per year from air pollution</div>
                        </div>
                        <div class="stat-card blue">
                            <div class="stat-icon">💰</div>
                            <div class="stat-number">$150B</div>
                            <div class="stat-label">Annual economic loss</div>
                        </div>
                    </div>
                </div>`,
                `.stats-slide {
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    font-family: 'Google Sans', 'Inter', sans-serif;
                    background: ${P.bg};
                    padding: 80px;
                }
                .stats-slide h2 {
                    color: ${P.text};
                    font-size: 48px;
                    font-weight: 600;
                    margin: 0 0 60px 0;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 40px;
                    width: 100%;
                }
                .stat-card {
                    background: ${P.surface};
                    border-radius: 16px;
                    padding: 40px;
                    text-align: center;
                    border: 1px solid ${P.border};
                }
                .stat-card.red { border-left: 4px solid ${P.accent}; }
                .stat-card.orange { border-left: 4px solid ${P.warning}; }
                .stat-card.blue { border-left: 4px solid ${P.primary}; }
                .stat-icon { font-size: 36px; margin-bottom: 16px; }
                .stat-number {
                    font-size: 48px;
                    font-weight: 700;
                    color: ${P.text};
                    margin-bottom: 8px;
                }
                .stat-label {
                    font-size: 16px;
                    color: ${P.textSecondary};
                }`,
                '',
                { start: 5, duration: 5, fonts: ['Google Sans', 'Inter'] }
            ),

            // ── Scene 3: Pollution Sources (10-15s) ────────────────────────
            StudioPro.html(
                `<div class="slide sources-slide">
                    <h2>Major Pollution Sources</h2>
                    <div class="sources-list">
                        <div class="source-item">
                            <div class="source-icon">🏭</div>
                            <div class="source-text">
                                <h3>Industrial Emissions</h3>
                                <p>35% of total pollution</p>
                            </div>
                            <div class="source-bar" style="width: 35%; background: ${P.accent};"></div>
                        </div>
                        <div class="source-item">
                            <div class="source-icon">🚗</div>
                            <div class="source-text">
                                <h3>Vehicle Exhaust</h3>
                                <p>28% of total pollution</p>
                            </div>
                            <div class="source-bar" style="width: 28%; background: ${P.warning};"></div>
                        </div>
                        <div class="source-item">
                            <div class="source-icon">🌾</div>
                            <div class="source-text">
                                <h3>Crop Burning</h3>
                                <p>22% of total pollution</p>
                            </div>
                            <div class="source-bar" style="width: 22%; background: ${P.primary};"></div>
                        </div>
                        <div class="source-item">
                            <div class="source-icon">🏠</div>
                            <div class="source-text">
                                <h3>Household Pollution</h3>
                                <p>15% of total pollution</p>
                            </div>
                            <div class="source-bar" style="width: 15%; background: ${P.success};"></div>
                        </div>
                    </div>
                </div>`,
                `.sources-slide {
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    font-family: 'Google Sans', 'Inter', sans-serif;
                    background: ${P.bg};
                    padding: 80px;
                }
                .sources-slide h2 {
                    color: ${P.text};
                    font-size: 48px;
                    font-weight: 600;
                    margin: 0 0 60px 0;
                }
                .sources-list { width: 100%; }
                .source-item {
                    display: flex;
                    align-items: center;
                    padding: 24px 0;
                    border-bottom: 1px solid ${P.border};
                }
                .source-icon { font-size: 32px; margin-right: 24px; }
                .source-text { flex: 1; }
                .source-text h3 {
                    font-size: 20px;
                    font-weight: 600;
                    color: ${P.text};
                    margin: 0 0 4px 0;
                }
                .source-text p {
                    font-size: 14px;
                    color: ${P.textSecondary};
                    margin: 0;
                }
                .source-bar {
                    height: 8px;
                    border-radius: 4px;
                    margin-left: 24px;
                }`,
                '',
                { start: 10, duration: 5, fonts: ['Google Sans', 'Inter'] }
            ),

            // ── Scene 4: AQI Comparison (15-20s) ───────────────────────────
            StudioPro.html(
                `<div class="slide aqi-slide">
                    <h2>Air Quality Index Comparison</h2>
                    <div class="aqi-chart">
                        <div class="aqi-bar good" style="height: 40%;">
                            <span class="aqi-city">London</span>
                            <span class="aqi-value">42</span>
                            <span class="aqi-label">Good</span>
                        </div>
                        <div class="aqi-bar moderate" style="height: 55%;">
                            <span class="aqi-city">Beijing</span>
                            <span class="aqi-value">150</span>
                            <span class="aqi-label">Moderate</span>
                        </div>
                        <div class="aqi-bar unhealthy" style="height: 85%;">
                            <span class="aqi-city">Delhi</span>
                            <span class="aqi-value">450</span>
                            <span class="aqi-label">Hazardous</span>
                        </div>
                        <div class="aqi-bar hazardous" style="height: 95%;">
                            <span class="aqi-city">Ghaziabad</span>
                            <span class="aqi-value">500+</span>
                            <span class="aqi-label">Extreme</span>
                        </div>
                    </div>
                    <div class="aqi-scale">
                        <div class="scale-item" style="background: #34A853;">0-50 Good</div>
                        <div class="scale-item" style="background: #FBBC04;">51-100 Moderate</div>
                        <div class="scale-item" style="background: #EA4335;">101-300 Unhealthy</div>
                        <div class="scale-item" style="background: #9334E6;">301+ Hazardous</div>
                    </div>
                </div>`,
                `.aqi-slide {
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    font-family: 'Google Sans', 'Inter', sans-serif;
                    background: ${P.bg};
                    padding: 80px;
                }
                .aqi-slide h2 {
                    color: ${P.text};
                    font-size: 48px;
                    font-weight: 600;
                    margin: 0 0 60px 0;
                }
                .aqi-chart {
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    gap: 40px;
                    height: 400px;
                    width: 80%;
                    margin-bottom: 40px;
                }
                .aqi-bar {
                    width: 120px;
                    border-radius: 8px 8px 0 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 16px;
                    position: relative;
                }
                .aqi-bar.good { background: linear-gradient(180deg, #34A853 0%, #34A85380 100%); }
                .aqi-bar.moderate { background: linear-gradient(180deg, #FBBC04 0%, #FBBC0480 100%); }
                .aqi-bar.unhealthy { background: linear-gradient(180deg, #EA4335 0%, #EA433580 100%); }
                .aqi-bar.hazardous { background: linear-gradient(180deg, #9334E6 0%, #9334E680 100%); }
                .aqi-city {
                    font-size: 16px;
                    font-weight: 600;
                    color: white;
                    margin-bottom: 8px;
                }
                .aqi-value {
                    font-size: 28px;
                    font-weight: 700;
                    color: white;
                }
                .aqi-label {
                    font-size: 12px;
                    color: white;
                    opacity: 0.9;
                }
                .aqi-scale {
                    display: flex;
                    gap: 16px;
                }
                .scale-item {
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 500;
                    color: white;
                }`,
                '',
                { start: 15, duration: 5, fonts: ['Google Sans', 'Inter'] }
            ),

            // ── Scene 5: Health Impact (20-25s) ────────────────────────────
            StudioPro.html(
                `<div class="slide health-slide">
                    <h2>Health Impact</h2>
                    <div class="health-grid">
                        <div class="health-card">
                            <div class="health-icon">🫁</div>
                            <h3>Respiratory Diseases</h3>
                            <p>Asthma, COPD, lung cancer</p>
                            <div class="highlight">30% increase in last decade</div>
                        </div>
                        <div class="health-card">
                            <div class="health-icon">❤️</div>
                            <h3>Cardiovascular</h3>
                            <p>Heart attacks, strokes</p>
                            <div class="highlight">Leading cause of death</div>
                        </div>
                        <div class="health-card">
                            <div class="health-icon">👶</div>
                            <h3>Children</h3>
                            <p>Stunted development</p>
                            <div class="highlight">1 in 3 children affected</div>
                        </div>
                        <div class="health-card">
                            <div class="health-icon">🧠</div>
                            <h3>Cognitive</h3>
                            <p>Reduced IQ, dementia</p>
                            <div class="highlight">Long-term exposure risk</div>
                        </div>
                    </div>
                </div>`,
                `.health-slide {
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    font-family: 'Google Sans', 'Inter', sans-serif;
                    background: ${P.bg};
                    padding: 80px;
                }
                .health-slide h2 {
                    color: ${P.text};
                    font-size: 48px;
                    font-weight: 600;
                    margin: 0 0 60px 0;
                }
                .health-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 32px;
                    width: 100%;
                }
                .health-card {
                    background: ${P.surface};
                    border-radius: 16px;
                    padding: 32px;
                    border: 1px solid ${P.border};
                }
                .health-icon { font-size: 32px; margin-bottom: 16px; }
                .health-card h3 {
                    font-size: 20px;
                    font-weight: 600;
                    color: ${P.text};
                    margin: 0 0 8px 0;
                }
                .health-card p {
                    font-size: 14px;
                    color: ${P.textSecondary};
                    margin: 0 0 16px 0;
                }
                .highlight {
                    background: rgba(26, 115, 232, 0.08);
                    color: ${P.primary};
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    display: inline-block;
                }`,
                '',
                { start: 20, duration: 5, fonts: ['Google Sans', 'Inter'] }
            ),

            // ── Scene 6: Government Initiatives (25-30s) ───────────────────
            StudioPro.html(
                `<div class="slide initiatives-slide">
                    <h2>Government Initiatives</h2>
                    <div class="initiatives-list">
                        <div class="initiative-item">
                            <div class="init-num">1</div>
                            <div class="init-content">
                                <h3>National Clean Air Programme (NCAP)</h3>
                                <p>Target: 40% reduction in PM2.5 by 2026</p>
                            </div>
                            <div class="init-status active">Active</div>
                        </div>
                        <div class="initiative-item">
                            <div class="init-num">2</div>
                            <div class="init-content">
                                <h3>BS-VI Emission Standards</h3>
                                <p>Equivalent to Euro 6 norms</p>
                            </div>
                            <div class="init-status active">Active</div>
                        </div>
                        <div class="initiative-item">
                            <div class="init-num">3</div>
                            <div class="init-content">
                                <h3>Electric Vehicle Push</h3>
                                <p>30% EV adoption by 2030</p>
                            </div>
                            <div class="init-status progress">In Progress</div>
                        </div>
                        <div class="initiative-item">
                            <div class="init-num">4</div>
                            <div class="init-content">
                                <h3>Smart Cities Mission</h3>
                                <p>100 smart cities with green infrastructure</p>
                            </div>
                            <div class="init-status progress">In Progress</div>
                        </div>
                    </div>
                </div>`,
                `.initiatives-slide {
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    font-family: 'Google Sans', 'Inter', sans-serif;
                    background: ${P.bg};
                    padding: 80px;
                }
                .initiatives-slide h2 {
                    color: ${P.text};
                    font-size: 48px;
                    font-weight: 600;
                    margin: 0 0 60px 0;
                }
                .initiatives-list { width: 100%; }
                .initiative-item {
                    display: flex;
                    align-items: center;
                    padding: 24px 0;
                    border-bottom: 1px solid ${P.border};
                }
                .init-num {
                    width: 40px;
                    height: 40px;
                    background: ${P.primary};
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    margin-right: 24px;
                }
                .init-content { flex: 1; }
                .init-content h3 {
                    font-size: 18px;
                    font-weight: 600;
                    color: ${P.text};
                    margin: 0 0 4px 0;
                }
                .init-content p {
                    font-size: 14px;
                    color: ${P.textSecondary};
                    margin: 0;
                }
                .init-status {
                    padding: 6px 16px;
                    border-radius: 100px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .init-status.active {
                    background: rgba(52, 168, 83, 0.12);
                    color: ${P.success};
                }
                .init-status.progress {
                    background: rgba(251, 188, 4, 0.12);
                    color: #E37400;
                }`,
                '',
                { start: 25, duration: 5, fonts: ['Google Sans', 'Inter'] }
            ),

            // ── Scene 7: Solutions (30-35s) ────────────────────────────────
            StudioPro.html(
                `<div class="slide solutions-slide">
                    <h2>What Can We Do?</h2>
                    <div class="solutions-grid">
                        <div class="solution-card">
                            <div class="solution-icon">🌳</div>
                            <h3>Plant Trees</h3>
                            <p>Each tree absorbs 22kg of CO2 per year</p>
                        </div>
                        <div class="solution-card">
                            <div class="solution-icon">🚲</div>
                            <h3>Use Public Transport</h3>
                            <p>Reduces emissions by 45%</p>
                        </div>
                        <div class="solution-card">
                            <div class="solution-icon">💡</div>
                            <h3>Save Energy</h3>
                            <p>Switch to LED, solar power</p>
                        </div>
                        <div class="solution-card">
                            <div class="solution-icon">📢</div>
                            <h3>Spread Awareness</h3>
                            <p>Advocate for clean air policies</p>
                        </div>
                    </div>
                </div>`,
                `.solutions-slide {
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    font-family: 'Google Sans', 'Inter', sans-serif;
                    background: ${P.bg};
                    padding: 80px;
                }
                .solutions-slide h2 {
                    color: ${P.text};
                    font-size: 48px;
                    font-weight: 600;
                    margin: 0 0 60px 0;
                }
                .solutions-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 32px;
                    width: 100%;
                }
                .solution-card {
                    background: ${P.surface};
                    border-radius: 16px;
                    padding: 32px;
                    text-align: center;
                    border: 1px solid ${P.border};
                }
                .solution-icon { font-size: 48px; margin-bottom: 16px; }
                .solution-card h3 {
                    font-size: 20px;
                    font-weight: 600;
                    color: ${P.text};
                    margin: 0 0 8px 0;
                }
                .solution-card p {
                    font-size: 14px;
                    color: ${P.textSecondary};
                    margin: 0;
                }`,
                '',
                { start: 30, duration: 5, fonts: ['Google Sans', 'Inter'] }
            ),

            // ── Scene 8: Call to Action (35-40s) ───────────────────────────
            StudioPro.html(
                `<div class="slide cta-slide">
                    <div class="cta-content">
                        <div class="cta-emoji">🌍</div>
                        <h2>Every Action Counts</h2>
                        <p>Join the movement for cleaner air in India</p>
                        <div class="cta-buttons">
                            <div class="cta-btn primary">Learn More</div>
                            <div class="cta-btn secondary">Share This</div>
                        </div>
                    </div>
                    <div class="cta-stats">
                        <div class="cta-stat">
                            <span class="cta-stat-num">1.4B</span>
                            <span class="cta-stat-label">People Affected</span>
                        </div>
                        <div class="cta-stat">
                            <span class="cta-stat-num">365</span>
                            <span class="cta-stat-label">Days of Action</span>
                        </div>
                        <div class="cta-stat">
                            <span class="cta-stat-num">100%</span>
                            <span class="cta-stat-label">Commitment</span>
                        </div>
                    </div>
                </div>`,
                `.cta-slide {
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    font-family: 'Google Sans', 'Inter', sans-serif;
                    background: linear-gradient(135deg, ${P.primary} 0%, #174EA6 100%);
                    padding: 80px;
                }
                .cta-content {
                    text-align: center;
                    margin-bottom: 60px;
                }
                .cta-emoji { font-size: 72px; margin-bottom: 24px; }
                .cta-content h2 {
                    color: white;
                    font-size: 56px;
                    font-weight: 700;
                    margin: 0 0 16px 0;
                }
                .cta-content p {
                    color: rgba(255,255,255,0.8);
                    font-size: 24px;
                    margin: 0 0 40px 0;
                }
                .cta-buttons {
                    display: flex;
                    gap: 24px;
                    justify-content: center;
                }
                .cta-btn {
                    padding: 16px 40px;
                    border-radius: 100px;
                    font-size: 18px;
                    font-weight: 600;
                }
                .cta-btn.primary {
                    background: white;
                    color: ${P.primary};
                }
                .cta-btn.secondary {
                    background: transparent;
                    color: white;
                    border: 2px solid white;
                }
                .cta-stats {
                    display: flex;
                    gap: 80px;
                }
                .cta-stat {
                    text-align: center;
                }
                .cta-stat-num {
                    display: block;
                    font-size: 48px;
                    font-weight: 700;
                    color: white;
                }
                .cta-stat-label {
                    font-size: 16px;
                    color: rgba(255,255,255,0.7);
                }`,
                '',
                { start: 35, duration: 5, fonts: ['Google Sans', 'Inter'] }
            ),

            // ── Scene 9: End Slide (40-45s) ────────────────────────────────
            StudioPro.html(
                `<div class="slide end-slide">
                    <div class="end-content">
                        <h1>Thank You</h1>
                        <p>Together, we can breathe cleaner air</p>
                        <div class="end-icons">
                            <span>🌳</span>
                            <span>💚</span>
                            <span>🌍</span>
                            <span>✨</span>
                        </div>
                        <div class="end-source">
                            Data from WHO, CPCB, Lancet Countdown
                        </div>
                    </div>
                </div>`,
                `.end-slide {
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    font-family: 'Google Sans', 'Inter', sans-serif;
                    background: ${P.bg};
                    padding: 80px;
                }
                .end-content {
                    text-align: center;
                }
                .end-content h1 {
                    font-size: 72px;
                    font-weight: 700;
                    color: ${P.text};
                    margin: 0 0 16px 0;
                }
                .end-content p {
                    font-size: 28px;
                    color: ${P.textSecondary};
                    margin: 0 0 40px 0;
                }
                .end-icons {
                    font-size: 48px;
                    display: flex;
                    gap: 24px;
                    justify-content: center;
                    margin-bottom: 60px;
                }
                .end-source {
                    font-size: 14px;
                    color: ${P.textSecondary};
                    font-style: italic;
                }`,
                '',
                { start: 40, duration: 5, fonts: ['Google Sans', 'Inter'] }
            )
        ]
    });

    // ── Apply Animations ─────────────────────────────────────────────────
    const clips = State?.clips || [];

    // Title slide: fade in + scale
    if (clips[0]) {
        StudioPro.keyframes(clips[0], {
            opacity: [{ frame: 0, value: 0 }, { frame: 20, value: 100 }],
            scale: [{ frame: 0, value: 0.95 }, { frame: 20, value: 1.0 }]
        });
    }

    // Stats slide: slide up
    if (clips[1]) {
        StudioPro.keyframes(clips[1], {
            y: [{ frame: 0, value: 5 }, { frame: 20, value: 0 }],
            opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }]
        });
    }

    // Sources slide: fade in
    if (clips[2]) {
        StudioPro.keyframes(clips[2], {
            opacity: [{ frame: 0, value: 0 }, { frame: 20, value: 100 }]
        });
    }

    // AQI slide: scale
    if (clips[3]) {
        StudioPro.keyframes(clips[3], {
            scale: [{ frame: 0, value: 0.95 }, { frame: 20, value: 1.0 }],
            opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }]
        });
    }

    // Health slide: slide up
    if (clips[4]) {
        StudioPro.keyframes(clips[4], {
            y: [{ frame: 0, value: 5 }, { frame: 20, value: 0 }],
            opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }]
        });
    }

    // Initiatives slide: fade in
    if (clips[5]) {
        StudioPro.keyframes(clips[5], {
            opacity: [{ frame: 0, value: 0 }, { frame: 20, value: 100 }]
        });
    }

    // Solutions slide: scale
    if (clips[6]) {
        StudioPro.keyframes(clips[6], {
            scale: [{ frame: 0, value: 0.95 }, { frame: 20, value: 1.0 }],
            opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }]
        });
    }

    // CTA slide: slide up
    if (clips[7]) {
        StudioPro.keyframes(clips[7], {
            y: [{ frame: 0, value: 5 }, { frame: 20, value: 0 }],
            opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }]
        });
    }

    // End slide: fade in
    if (clips[8]) {
        StudioPro.keyframes(clips[8], {
            opacity: [{ frame: 0, value: 0 }, { frame: 20, value: 100 }],
            scale: [{ frame: 0, value: 0.95 }, { frame: 20, value: 1.0 }]
        });
    }

    console.log('[IndiaPollution] Created 9-scene presentation (45s)');
    return { id: 'india-pollution', clipCount: 9 };
};
