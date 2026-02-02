/**
 * SignalCraft Core Logic
 * 
 * Philosophy: Hidden regimes drive price. User detects regime -> Profits.
 */

// --- CONFIGURATION ---
const CONFIG = {
    TICK_RATE: 100, // ms per tick
    HISTORY_SIZE: 100, // Number of candles/ticks to show
    STARTING_BALANCE: 0, // Start with $0, must work first
    COMMISSION: 0.001, // 0.1% fee to discourage spamming
    HOURLY_WAGE: 15, // $15/hour at McDonald's
    WORK_SPEED_MULTIPLIER: 360, // 1 real second = 6 minutes game time (8hr work = ~80 seconds)
};

// --- ENUMS ---
const REGIMES = {
    RANGE: 'RANGE',           // Mean reverting
    TREND_UP: 'TREND_UP',     // Consistent higher highs
    TREND_DOWN: 'TREND_DOWN', // Consistent lower lows
    VOLATILITY: 'VOLATILITY'  // High noise, scary
};

// --- STATE ---
const state = {
    balance: CONFIG.STARTING_BALANCE,
    shares: 0,
    avgCost: 0,
    level: 1,
    xp: 0,
    nextLevelXp: 1000,

    // Market State
    prices: [],
    currentPrice: 100.00,
    tickCount: 0,

    // Hidden Market Mechanics
    currentRegime: REGIMES.RANGE,
    regimeTimer: 0,
    regimeDuration: 200, // Ticks until potential switch
    baseValue: 100.00, // Center of gravity for ranges
    momentum: 0,
    volatility: 0.5,

    // Strategy
    autoStrategyActive: false,
    lastStrategyAction: 0, // Tick count of last action

    // Work System
    currentScreen: 'WORK', // 'WORK' or 'TRADE'
    workInProgress: false,
    workStartTime: null,
    workDuration: 0, // hours
    totalHoursWorked: 0,
    workTimerId: null,
};

// --- DOM ELEMENTS ---
const ui = {
    balance: document.getElementById('balance-display'),
    level: document.getElementById('level-display'),
    xpBar: document.getElementById('xp-bar'),
    price: document.getElementById('current-price'),
    change: document.getElementById('price-change'),
    canvas: document.getElementById('market-chart'),
    positionTracker: document.getElementById('position-tracker'),
    posSize: document.getElementById('position-size'),
    posPnl: document.getElementById('position-pnl'),
    feedbackPanel: document.getElementById('feedback-panel'),
    feedbackMsg: document.getElementById('feedback-message'),
    feedbackSub: document.getElementById('feedback-insight'),
    btnBuy: document.getElementById('buy-btn'),
    btnSell: document.getElementById('sell-btn'),
    btnStrategy: document.getElementById('strategy-btn'),

    // Work Screen Elements
    workScreen: document.getElementById('work-screen'),
    tradeScreen: document.getElementById('trade-screen'),
    btnWork4h: document.getElementById('work-4h'),
    btnWork8h: document.getElementById('work-8h'),
    workProgress: document.getElementById('work-progress'),
    workTimer: document.getElementById('work-timer'),
    btnGoToTrade: document.getElementById('go-to-trade'),
    btnGoToWork: document.getElementById('go-to-work'),
};

const ctx = ui.canvas.getContext('2d');

// --- HELPER FUNCTIONS ---
const fmtMoney = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmtNum = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const rand = (min, max) => Math.random() * (max - min) + min;

// --- MARKET ENGINE ---

function initMarket() {
    // Fill initial history
    for (let i = 0; i < CONFIG.HISTORY_SIZE; i++) {
        updateMarketLogic();
        state.prices.push(state.currentPrice);
    }
    renderLoop();
    setInterval(gameTick, CONFIG.TICK_RATE);
}

function switchRegime() {
    const r = Object.keys(REGIMES);
    const weights = {
        [REGIMES.RANGE]: 0.4,
        [REGIMES.TREND_UP]: 0.25,
        [REGIMES.TREND_DOWN]: 0.25,
        [REGIMES.VOLATILITY]: 0.1
    };

    // Weighted random choice could go here, for now simple random with bias
    const randVal = Math.random();
    if (randVal < 0.4) state.currentRegime = REGIMES.RANGE;
    else if (randVal < 0.65) state.currentRegime = REGIMES.TREND_UP;
    else if (randVal < 0.9) state.currentRegime = REGIMES.TREND_DOWN;
    else state.currentRegime = REGIMES.VOLATILITY;

    state.regimeDuration = Math.floor(rand(100, 300));
    state.regimeTimer = 0;

    // Regime entry setup
    if (state.currentRegime === REGIMES.RANGE) {
        state.baseValue = state.currentPrice; // Reset anchor
        state.volatility = 0.3;
    } else if (state.currentRegime === REGIMES.VOLATILITY) {
        state.volatility = 1.5;
    } else {
        state.volatility = 0.5;
    }
}

function updateMarketLogic() {
    state.tickCount++;
    state.regimeTimer++;

    if (state.regimeTimer > state.regimeDuration) {
        switchRegime();
    }

    let change = 0;
    const noise = (Math.random() - 0.5) * state.volatility;

    switch (state.currentRegime) {
        case REGIMES.TREND_UP:
            change = 0.1 + noise; // Upward bias
            break;
        case REGIMES.TREND_DOWN:
            change = -0.1 + noise; // Downward bias
            break;
        case REGIMES.RANGE:
            // Mean reversion force
            const dist = state.baseValue - state.currentPrice;
            change = (dist * 0.05) + noise;
            break;
        case REGIMES.VOLATILITY:
            change = (Math.random() - 0.5) * 3.0; // Huge swings
            break;
    }

    state.currentPrice += change;
    if (state.currentPrice < 1) state.currentPrice = 1; // Floor
}

function gameTick() {
    updateMarketLogic();

    // Clean history
    state.prices.push(state.currentPrice);
    if (state.prices.length > CONFIG.HISTORY_SIZE) {
        state.prices.shift();
    }

    // Auto Strategy Logic
    if (state.autoStrategyActive && state.tickCount % 10 === 0) {
        runAutoStrategy();
    }

    updateUI();
}

// --- WORK SYSTEM ---

function startWork(hours) {
    if (state.workInProgress) return;

    state.workInProgress = true;
    state.workStartTime = Date.now();
    state.workDuration = hours;

    // Show progress UI
    ui.workProgress.classList.remove('hidden');
    ui.btnWork4h.disabled = true;
    ui.btnWork8h.disabled = true;

    // Start timer (simulated time)
    const totalMs = (hours * 3600 * 1000) / CONFIG.WORK_SPEED_MULTIPLIER; // Real time needed
    const updateInterval = 100; // Update every 100ms

    state.workTimerId = setInterval(() => {
        updateWorkTimer(totalMs);
    }, updateInterval);

    // Auto-complete after duration
    setTimeout(() => {
        completeWork();
    }, totalMs);
}

function updateWorkTimer(totalMs) {
    const elapsed = Date.now() - state.workStartTime;
    const remaining = Math.max(0, totalMs - elapsed);
    const gameTimeElapsed = (elapsed / 1000) * CONFIG.WORK_SPEED_MULTIPLIER; // Convert to game seconds

    const hours = Math.floor(gameTimeElapsed / 3600);
    const minutes = Math.floor((gameTimeElapsed % 3600) / 60);
    const seconds = Math.floor(gameTimeElapsed % 60);

    ui.workTimer.innerText = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function completeWork() {
    if (!state.workInProgress) return;

    clearInterval(state.workTimerId);

    const earnings = state.workDuration * CONFIG.HOURLY_WAGE;
    state.balance += earnings;
    state.totalHoursWorked += state.workDuration;

    state.workInProgress = false;
    state.workStartTime = null;

    // Reset UI
    ui.workProgress.classList.add('hidden');
    ui.btnWork4h.disabled = false;
    ui.btnWork8h.disabled = false;

    showFeedback(`Shift Complete!`, `Earned ${fmtMoney(earnings)} for ${state.workDuration} hours of work.`);
    updateUI();
}

function switchScreen(screen) {
    state.currentScreen = screen;

    if (screen === 'WORK') {
        ui.workScreen.classList.remove('hidden');
        ui.tradeScreen.classList.add('hidden');
    } else {
        ui.workScreen.classList.add('hidden');
        ui.tradeScreen.classList.remove('hidden');
    }
}

// --- PLAYER ACTIONS ---

function buy() {
    // Max buy
    const amt = Math.floor(state.balance / state.currentPrice);
    if (amt <= 0) return;

    const cost = amt * state.currentPrice;
    state.balance -= cost;

    // Avg Cost calculation
    const totalVal = (state.shares * state.avgCost) + cost;
    state.shares += amt;
    state.avgCost = totalVal / state.shares;

    showFeedback("Opened Long", "Market entry executed.");
    ui.positionTracker.classList.remove('hidden');
}

function sell() {
    if (state.shares <= 0) return;

    const revenue = state.shares * state.currentPrice;
    const profit = revenue - (state.shares * state.avgCost);

    state.balance += revenue;
    state.shares = 0;

    state.balance = parseFloat(state.balance.toFixed(2)); // Float fix

    evaluateTrade(profit);
    ui.positionTracker.classList.add('hidden');
}

function toggleStrategy() {
    state.autoStrategyActive = !state.autoStrategyActive;
    ui.btnStrategy.classList.toggle('active');
    ui.btnStrategy.innerHTML = state.autoStrategyActive
        ? `<span class="icon">⚡</span> Auto-Strategy: ON`
        : `<span class="icon">⚡</span> Auto-Strategy: OFF`;
}

// --- STRATEGY BOT ---
function runAutoStrategy() {
    // Simple logic based on moving averages to mimic detecting trend vs range
    // In a real game, this would be unlockable logic.

    const prices = state.prices;
    const len = prices.length;
    if (len < 20) return;

    const maSlow = prices.slice(len - 50).reduce((a, b) => a + b, 0) / 50;
    const maFast = prices.slice(len - 10).reduce((a, b) => a + b, 0) / 10;

    const isUptrend = maFast > maSlow;
    const isDip = state.currentPrice < maFast;

    // Cooldown
    if (state.tickCount - state.lastStrategyAction < 20) return;

    if (state.shares === 0) {
        // Buy logic
        if (state.currentRegime === REGIMES.TREND_UP && isUptrend) {
            buy();
            state.lastStrategyAction = state.tickCount;
        } else if (state.currentRegime === REGIMES.RANGE && state.currentPrice < state.baseValue * 0.99) {
            buy(); // Mean reversion buy
            state.lastStrategyAction = state.tickCount;
        }
    } else {
        // Sell logic
        const pnl = (state.currentPrice - state.avgCost) / state.avgCost;
        if (pnl > 0.05 || pnl < -0.02) { // Take profit or stop loss
            sell();
            state.lastStrategyAction = state.tickCount;
        }
    }
}

// --- FEEDBACK & PROGRESSION ---

function evaluateTrade(profit) {
    const isWin = profit > 0;
    let title = isWin ? "Profit Secured" : "Loss Realized";
    let message = "";

    // Contextual Feedback
    if (state.currentRegime === REGIMES.TREND_UP) {
        if (isWin) message = "You rode the momentum correctly.";
        else message = "Trend was intact, but timing was off.";
    } else if (state.currentRegime === REGIMES.RANGE) {
        if (isWin) message = "Good scalping in a sideways market.";
        else message = "Range broke or you bought the top.";
    } else if (state.currentRegime === REGIMES.TREND_DOWN) {
        if (isWin) message = "Wait, you profited in a downtrend? Lucky bounce.";
        else message = "Never catch a falling knife.";
    } else {
        message = "Volatility is unpredictable. High risk environment.";
    }

    // Progression
    if (isWin) {
        const xpGain = Math.floor(profit * 0.1); // 10% of profit is XP
        addXp(Math.max(10, xpGain));
    } else {
        addXp(5); // Participation award (learning from mistakes)
    }

    showFeedback(title + ` (${fmtMoney(profit)})`, message);
}

function addXp(amount) {
    state.xp += amount;
    if (state.xp >= state.nextLevelXp) {
        state.level++;
        state.xp = 0;
        state.nextLevelXp *= 1.5;
        ui.level.innerText = state.level;
        showFeedback("LEVEL UP!", "Market Intuition Increased.");
    }
    const pct = (state.xp / state.nextLevelXp) * 100;
    ui.xpBar.style.width = `${pct}%`;
}


function showFeedback(main, sub) {
    ui.feedbackMsg.innerText = main;
    ui.feedbackMsg.className = "feedback-text " + (main.includes("Loss") || main.includes("falling") ? "text-down" : "text-up");
    ui.feedbackSub.innerText = sub;

    ui.feedbackPanel.classList.add('visible');
    ui.feedbackPanel.classList.remove('hidden');

    // Clear after 3s
    setTimeout(() => {
        ui.feedbackPanel.classList.remove('visible');
        setTimeout(() => ui.feedbackPanel.classList.add('hidden'), 300);
    }, 4000);
}

// --- RENDERING ---

function updateUI() {
    ui.price.innerText = state.currentPrice.toFixed(2);
    ui.balance.innerText = fmtMoney(state.balance);

    // Delta
    const lastPrice = state.prices[state.prices.length - 2] || state.currentPrice;
    const delta = ((state.currentPrice - lastPrice) / lastPrice) * 100;
    ui.change.innerText = (delta >= 0 ? "+" : "") + delta.toFixed(2) + "%";
    ui.change.className = "price-delta " + (delta >= 0 ? "up" : "down");

    // Position
    if (state.shares > 0) {
        const curVal = state.shares * state.currentPrice;
        const costVal = state.shares * state.avgCost;
        const diff = curVal - costVal;
        ui.posSize.innerText = state.shares;
        ui.posPnl.innerText = fmtMoney(diff);
        ui.posPnl.className = "value " + (diff >= 0 ? "text-up" : "text-down");
    }

    // Update total hours worked display
    const totalHoursEl = document.getElementById('total-hours');
    if (totalHoursEl) {
        totalHoursEl.innerText = state.totalHoursWorked;
    }

    // Feature Unlocking
    if (state.level >= 2) {
        ui.btnStrategy.parentElement.style.display = 'flex';
    } else {
        ui.btnStrategy.parentElement.style.display = 'none';
    }

    if (state.level >= 3) {
        const hint = document.getElementById('regime-hint-overlay');
        hint.classList.remove('hidden');

        // Update hint text logic
        let regimeText = "Detecting...";
        if (state.currentRegime.includes('TREND')) regimeText = "TREND DETECTED";
        else if (state.currentRegime === 'RANGE') regimeText = "RANGE BOUND";
        else regimeText = "HIGH VOLATILITY";

        document.getElementById('regime-text').innerText = regimeText;
    }

    drawChart();
}

function drawChart() {
    // Resize canvas
    ui.canvas.width = ui.canvas.parentElement.clientWidth;
    ui.canvas.height = ui.canvas.parentElement.clientHeight;

    const w = ui.canvas.width;
    const h = ui.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Find min/max for scaling
    let min = Infinity, max = -Infinity;
    state.prices.forEach(p => {
        if (p < min) min = p;
        if (p > max) max = p;
    });

    const padding = (max - min) * 0.1;
    min -= padding;
    max += padding;
    const range = max - min;

    // Draw Grid (Premium touch)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horizontal lines
    for (let i = 1; i < 5; i++) {
        const y = (h / 5) * i;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Draw Line
    ctx.beginPath();
    ctx.strokeStyle = '#64748b'; // Default Color
    ctx.lineWidth = 2;

    state.prices.forEach((p, i) => {
        const x = (i / (CONFIG.HISTORY_SIZE - 1)) * w;
        const y = h - ((p - min) / range) * h;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Gradient Fill
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "rgba(100, 116, 139, 0.2)");
    gradient.addColorStop(1, "rgba(100, 116, 139, 0)");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Current Price Dot
    const lastY = h - ((state.currentPrice - min) / range) * h;
    ctx.beginPath();
    ctx.fillStyle = state.prices[state.prices.length - 1] > state.prices[state.prices.length - 2] ? '#10b981' : '#ef4444';
    ctx.arc(w, lastY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.fillStyle;
}

// --- PERSISTENCE ---

function saveGame() {
    const data = {
        balance: state.balance,
        level: state.level,
        xp: state.xp,
        nextLevelXp: state.nextLevelXp,
        shares: state.shares,
        avgCost: state.avgCost,
        autoStrategyActive: state.autoStrategyActive,
        currentScreen: state.currentScreen,
        totalHoursWorked: state.totalHoursWorked,
        workInProgress: state.workInProgress,
        workDuration: state.workDuration,
        workStartTime: state.workStartTime,
        lastSaveTime: Date.now()
    };
    localStorage.setItem('signalcraft_save', JSON.stringify(data));
}

function loadGame() {
    const json = localStorage.getItem('signalcraft_save');
    if (!json) return; // No save found

    try {
        const data = JSON.parse(json);
        state.balance = data.balance;
        state.level = data.level;
        state.xp = data.xp;
        state.nextLevelXp = data.nextLevelXp;
        state.shares = data.shares;
        state.avgCost = data.avgCost;
        state.autoStrategyActive = data.autoStrategyActive;
        state.currentScreen = data.currentScreen || 'WORK';
        state.totalHoursWorked = data.totalHoursWorked || 0;

        // Restore work in progress or complete offline work
        if (data.workInProgress && data.workStartTime && data.workDuration) {
            const now = Date.now();
            const workTotalMs = (data.workDuration * 3600 * 1000) / CONFIG.WORK_SPEED_MULTIPLIER;
            const workElapsed = now - data.workStartTime;

            if (workElapsed >= workTotalMs) {
                // Work completed while offline
                const earnings = data.workDuration * CONFIG.HOURLY_WAGE;
                state.balance += earnings;
                state.totalHoursWorked += data.workDuration;
                showFeedback("Work Completed Offline!", `Earned ${fmtMoney(earnings)} while you were away.`);
            } else {
                // Resume work in progress
                state.workInProgress = true;
                state.workStartTime = data.workStartTime;
                state.workDuration = data.workDuration;

                const remaining = workTotalMs - workElapsed;
                ui.workProgress.classList.remove('hidden');
                ui.btnWork4h.disabled = true;
                ui.btnWork8h.disabled = true;

                state.workTimerId = setInterval(() => {
                    updateWorkTimer(workTotalMs);
                }, 100);

                setTimeout(() => {
                    completeWork();
                }, remaining);
            }
        }

        // Offline Trading Progress
        if (data.lastSaveTime) {
            const now = Date.now();
            const elapsed = now - data.lastSaveTime;

            // Only simulate if gone for > 1 minute and Auto Strategy is ON
            if (elapsed > 60000 && state.autoStrategyActive) {
                // Approximate ticks skipped
                const ticks = Math.floor(elapsed / CONFIG.TICK_RATE);

                // Simulate a simplified result:
                // Assume bot wins 55% of the time in good regimes, loosens in bad ones.
                // To keep it simple and rewarding:
                const estimatedTrades = Math.floor(ticks / 50); // Bot trades every ~50 ticks avg
                if (estimatedTrades > 0) {
                    const profitPerTrade = state.balance * 0.01; // 1% avg
                    const netProfit = estimatedTrades * profitPerTrade * 0.2; // Conservative 20% win rate net

                    state.balance += netProfit;
                    showFeedback("Welcome Back", `Auto-Bot executed ~${estimatedTrades} trades. Net Change: ${fmtMoney(netProfit)}`);
                }
            }
        }

        // Update UI immediately
        ui.level.innerText = state.level;
        const pct = (state.xp / state.nextLevelXp) * 100;
        ui.xpBar.style.width = `${pct}%`;

        // Restore buttons state
        if (state.autoStrategyActive) {
            ui.btnStrategy.classList.add('active');
            ui.btnStrategy.innerHTML = `<span class="icon">⚡</span> Auto-Strategy: ON`;
        }

        // Switch to correct screen
        switchScreen(state.currentScreen);

    } catch (e) {
        console.error("Save file corrupted", e);
    }
}

// Auto-save every 5 seconds
setInterval(saveGame, 5000);

// --- INIT ---
ui.btnBuy.addEventListener('click', buy);
ui.btnSell.addEventListener('click', sell);
ui.btnStrategy.addEventListener('click', toggleStrategy);

// Work System Event Listeners
ui.btnWork4h.addEventListener('click', () => startWork(4));
ui.btnWork8h.addEventListener('click', () => startWork(8));
ui.btnGoToTrade.addEventListener('click', () => switchScreen('TRADE'));
ui.btnGoToWork.addEventListener('click', () => switchScreen('WORK'));

// Hide unlocks initially
ui.btnStrategy.parentElement.style.display = 'none';

loadGame();
initMarket();
switchScreen(state.currentScreen); // Set initial screen
