/**
 * SignalCraft Core Logic
 * 
 * Philosophy: Hidden regimes drive price. User detects regime -> Profits.
 */

// --- CONFIGURATION ---
const CONFIG = {
    TICK_RATE: 100, // ms per tick
    HISTORY_SIZE: 100, // Number of candles/ticks to show
    STARTING_BALANCE: 100, // Start with $100
    COMMISSION: 0.001, // 0.1% fee to discourage spamming
    DAILY_COST: 30, // $30/day for rent + food
    WORK_INCOME: 120, // $120 for working one day
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

    // Day-Based Survival System
    currentDay: 1,
    negativeDaysStreak: 0, // Consecutive days ending with negative balance
    gameOver: false,
    currentScreen: 'ACTION', // 'ACTION' or 'TRADE' or 'GAMEOVER'
    canTrade: false, // Only true if player chose "Trade" today
    actionTakenToday: false,
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

    // Day-Based System Elements
    dayNumber: document.getElementById('day-number'),
    negativeStreak: document.getElementById('negative-streak'),
    streakCount: document.getElementById('streak-count'),
    actionScreen: document.getElementById('action-screen'),
    tradeScreen: document.getElementById('trade-screen'),
    gameOverScreen: document.getElementById('game-over-screen'),
    btnActionWork: document.getElementById('action-work'),
    btnActionTrade: document.getElementById('action-trade'),
    btnActionSleep: document.getElementById('action-sleep'),
    btnEndDay: document.getElementById('end-day-btn'),
    btnRestart: document.getElementById('restart-btn'),
};

const ctx = ui.canvas.getContext('2d');

// --- HELPER FUNCTIONS ---
const fmtMoney = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmtNum = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const rand = (min, max) => Math.random() * (max - min) + min;

// --- MARKET ENGINE ---

function renderLoop() {
    updateUI();
    requestAnimationFrame(renderLoop);
}

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

// --- DAY-BASED SURVIVAL SYSTEM ---

function doWork() {
    console.log('doWork called', { actionTakenToday: state.actionTakenToday });
    if (state.actionTakenToday) {
        console.log('Action already taken today');
        return;
    }

    state.balance += CONFIG.WORK_INCOME;
    state.actionTakenToday = true;

    console.log('Work complete, new balance:', state.balance);
    showFeedback("Work Complete!", `Earned ${fmtMoney(CONFIG.WORK_INCOME)} from McDonald's.`);

    // End day instantly
    endDay();
}

function doTrade() {
    console.log('doTrade called');
    // Trading is free now - doesn't consume day until you click "End Day"
    // or if you want to just check prices and leave

    state.canTrade = true;
    switchScreen('TRADE');
}

function doSleep() {
    console.log('doSleep called', { actionTakenToday: state.actionTakenToday });
    if (state.actionTakenToday) {
        console.log('Action already taken today');
        return;
    }

    state.actionTakenToday = true;
    console.log('Going to sleep');
    showFeedback("Sleeping...", "You rested but earned no income today.");

    // End day instantly
    endDay();
}

function endDay() {
    // Deduct daily costs
    state.balance -= CONFIG.DAILY_COST;

    // Check if balance is negative
    if (state.balance < 0) {
        state.negativeDaysStreak++;
    } else {
        state.negativeDaysStreak = 0; // Reset streak
    }

    // Check for game over
    if (state.negativeDaysStreak >= 3) {
        gameOver();
        return;
    }

    // Advance to next day
    state.currentDay++;
    state.actionTakenToday = false;
    state.canTrade = false;

    // Survival XP
    addXp(10);

    // Show end of day summary
    const streakWarning = state.negativeDaysStreak > 0
        ? ` ⚠️ Negative balance ${state.negativeDaysStreak}/3 days!`
        : "";

    showFeedback(
        `Day ${state.currentDay - 1} Complete`,
        `Daily cost: -${fmtMoney(CONFIG.DAILY_COST)}. Balance: ${fmtMoney(state.balance)}${streakWarning}`
    );

    // Return to action screen quickly
    setTimeout(() => {
        switchScreen('ACTION');
        updateUI();
    }, 500);
}

function checkGameOver() {
    return state.negativeDaysStreak >= 3;
}

function gameOver() {
    state.gameOver = true;
    switchScreen('GAMEOVER');

    // Update final stats
    const finalDaysEl = document.getElementById('final-days');
    const finalBalanceEl = document.getElementById('final-balance');
    if (finalDaysEl) finalDaysEl.innerText = state.currentDay;
    if (finalBalanceEl) finalBalanceEl.innerText = fmtMoney(state.balance);

    showFeedback(
        "Game Over",
        `You couldn't afford living costs for 3 days in a row. Survived ${state.currentDay} days.`
    );
}

function restartGame() {
    // Reset all state
    state.balance = CONFIG.STARTING_BALANCE;
    state.shares = 0;
    state.avgCost = 0;
    state.level = 1;
    state.xp = 0;
    state.currentDay = 1;
    state.negativeDaysStreak = 0;
    state.gameOver = false;
    state.actionTakenToday = false;
    state.canTrade = false;
    state.autoStrategyActive = false;

    // Clear save
    localStorage.removeItem('signalcraft_save');

    switchScreen('ACTION');
    updateUI();

    showFeedback("New Game", "Good luck! Manage your money wisely.");
}

function forceReset() {
    localStorage.clear();
    state.actionTakenToday = false;
    location.reload();
}

function switchScreen(screen) {
    console.log('switchScreen called:', screen);
    state.currentScreen = screen;

    if (screen === 'ACTION') {
        console.log('Showing ACTION screen');
        if (ui.actionScreen) ui.actionScreen.classList.remove('hidden');
        if (ui.tradeScreen) ui.tradeScreen.classList.add('hidden');
        if (ui.gameOverScreen) ui.gameOverScreen.classList.add('hidden');
    } else if (screen === 'TRADE') {
        console.log('Showing TRADE screen');
        if (ui.actionScreen) ui.actionScreen.classList.add('hidden');
        if (ui.tradeScreen) ui.tradeScreen.classList.remove('hidden');
        if (ui.gameOverScreen) ui.gameOverScreen.classList.add('hidden');
    } else if (screen === 'GAMEOVER') {
        console.log('Showing GAMEOVER screen');
        if (ui.actionScreen) ui.actionScreen.classList.add('hidden');
        if (ui.tradeScreen) ui.tradeScreen.classList.add('hidden');
        if (ui.gameOverScreen) ui.gameOverScreen.classList.remove('hidden');
    }
    console.log('Screen switched successfully');
}


// --- PLAYER ACTIONS ---

function buy() {
    // Check if trading is allowed today
    if (!state.canTrade) {
        showFeedback("Can't Trade", "You must choose 'Trade' action first!");
        return;
    }

    // Use slider percentage
    const pct = parseInt(ui.tradeSlider.value) / 100;
    const availableBalance = state.balance * pct;

    const amt = Math.floor(availableBalance / state.currentPrice);
    if (amt <= 0) {
        showFeedback("Order Failed", "Insufficient funds for this amount.");
        return;
    }

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
    // Check if trading is allowed today
    if (!state.canTrade) {
        showFeedback("Can't Trade", "You must choose 'Trade' action first!");
        return;
    }

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

    // Feature Unlocking
    if (state.level >= 2) {
        ui.btnStrategy.parentElement.style.display = 'flex';
    } else {
        ui.btnStrategy.parentElement.style.display = 'none';
    }

    // Disable action buttons if action already taken
    if (state.actionTakenToday) {
        if (ui.btnActionWork) {
            ui.btnActionWork.style.opacity = '0.5';
            ui.btnActionWork.style.pointerEvents = 'none';
            ui.btnActionWork.innerHTML = '<div class="card-icon">✅</div><h3>Done!</h3>';
        }
        if (ui.btnActionSleep) {
            ui.btnActionSleep.style.opacity = '0.5';
            ui.btnActionSleep.style.pointerEvents = 'none';
        }
    } else {
        // Reset button states
        if (ui.btnActionWork) {
            ui.btnActionWork.style.opacity = '1';
            ui.btnActionWork.style.pointerEvents = 'auto';
            ui.btnActionWork.innerHTML = '<div class="card-icon">💼</div><h3>Work</h3><p class="card-desc">McDonald\'s</p><div class="card-stats"><span class="stat-badge income">+$120</span></div><p class="card-hint">Guaranteed income</p>';
        }
        // Trade button always active
        if (ui.btnActionTrade) {
            ui.btnActionTrade.style.opacity = '1';
            ui.btnActionTrade.style.pointerEvents = 'auto';
            ui.btnActionTrade.innerHTML = '<div class="card-icon">📈</div><h3>Trade</h3><p class="card-desc">Stock Market</p><div class="card-stats"><span class="stat-badge risk">High Risk</span></div><p class="card-hint">Potential profits</p>';
        }
        if (ui.btnActionSleep) {
            ui.btnActionSleep.style.opacity = '1';
            ui.btnActionSleep.style.pointerEvents = 'auto';
        }
    }

    // Update Trade Slider Money Display
    if (ui.tradeSlider && ui.tradeMoney) {
        const pct = parseInt(ui.tradeSlider.value) / 100;
        const amount = state.balance * pct;
        ui.tradeMoney.innerText = fmtMoney(amount);
    }

    // XP / Level Bar
    ui.level.innerText = state.level;
    const xpPct = (state.xp / state.nextLevelXp) * 100;
    ui.xpBar.style.width = `${xpPct}%`;

    if (state.level >= 3) {
        const hint = document.getElementById('regime-hint-overlay');
        if (hint) {
            hint.classList.remove('hidden');
            let regimeText = "Detecting...";
            if (state.currentRegime.includes('TREND')) regimeText = "TREND DETECTED";
            else if (state.currentRegime === 'RANGE') regimeText = "RANGE BOUND";
            else regimeText = "HIGH VOLATILITY";
            document.getElementById('regime-text').innerText = regimeText;
        }
    }

    // Update day number
    if (ui.dayNumber) {
        ui.dayNumber.innerText = state.currentDay;
    }

    // Update negative streak warning
    if (ui.negativeStreak && ui.streakCount) {
        if (state.negativeDaysStreak > 0) {
            ui.negativeStreak.classList.remove('hidden');
            ui.streakCount.innerText = state.negativeDaysStreak;
        } else {
            ui.negativeStreak.classList.add('hidden');
        }
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
        currentDay: state.currentDay,
        negativeDaysStreak: state.negativeDaysStreak,
        gameOver: state.gameOver,
        canTrade: state.canTrade,
        actionTakenToday: state.actionTakenToday,
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
        state.currentScreen = data.currentScreen || 'ACTION';
        state.currentDay = data.currentDay || 1;
        state.negativeDaysStreak = data.negativeDaysStreak || 0;
        state.gameOver = data.gameOver || false;
        state.canTrade = data.canTrade || false;

        // BUG FIX: Always reset actionTakenToday on load
        // This prevents soft-locks if the game was closed during the action delay
        state.actionTakenToday = false;

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
// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Re-initialize UI references to ensure they exist
    ui.btnBuy = document.getElementById('buy-btn');
    ui.btnSell = document.getElementById('sell-btn');
    ui.btnStrategy = document.getElementById('strategy-btn');
    ui.btnActionWork = document.getElementById('action-work');
    ui.btnActionTrade = document.getElementById('action-trade');
    ui.btnActionSleep = document.getElementById('action-sleep');
    ui.btnActionSleep = document.getElementById('action-sleep');
    ui.btnDebugReset = document.getElementById('debug-reset');
    ui.btnEndDay = document.getElementById('end-day-btn');
    ui.btnTradeBack = document.getElementById('trade-back-btn'); // NEW
    ui.btnRestart = document.getElementById('restart-btn');

    ui.tradeSlider = document.getElementById('trade-amount-slider'); // NEW
    ui.tradeDisplay = document.getElementById('trade-amount-display'); // NEW
    ui.tradeMoney = document.getElementById('trade-amount-money'); // NEW

    // Add event listeners with null checks
    if (ui.btnBuy) ui.btnBuy.addEventListener('click', buy);
    if (ui.btnSell) ui.btnSell.addEventListener('click', sell);
    if (ui.btnStrategy) ui.btnStrategy.addEventListener('click', toggleStrategy);

    // Day-Based Action System Event Listeners
    if (ui.btnActionWork) ui.btnActionWork.addEventListener('click', doWork);
    if (ui.btnActionTrade) ui.btnActionTrade.addEventListener('click', doTrade);
    if (ui.btnActionSleep) ui.btnActionSleep.addEventListener('click', doSleep);
    if (ui.btnDebugReset) ui.btnDebugReset.addEventListener('click', forceReset);
    if (ui.btnEndDay) ui.btnEndDay.addEventListener('click', endDay);
    if (ui.btnTradeBack) ui.btnTradeBack.addEventListener('click', () => switchScreen('ACTION')); // NEW
    if (ui.btnRestart) ui.btnRestart.addEventListener('click', restartGame);

    // Slider listener
    if (ui.tradeSlider) {
        ui.tradeSlider.addEventListener('input', (e) => {
            if (ui.tradeDisplay) ui.tradeDisplay.innerText = e.target.value + '%';
            updateUI(); // To update money display
        });
    }

    // Hide unlocks initially
    if (ui.btnStrategy && ui.btnStrategy.parentElement) {
        ui.btnStrategy.parentElement.style.display = 'none';
    }

    loadGame();
    console.log('Game loaded. Initial state:', {
        currentDay: state.currentDay,
        balance: state.balance,
        actionTakenToday: state.actionTakenToday,
        currentScreen: state.currentScreen
    });
    initMarket();
    switchScreen(state.currentScreen); // Set initial screen
});
