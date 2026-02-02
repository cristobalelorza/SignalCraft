# Debugging Guide for SignalCraft

## How to Test the Game

1. **Open the game** in your browser:
   - Navigate to: `c:\Users\crise\Desktop\Negocios\FullPort\index.html`
   - Right-click the file → "Open with" → Your browser (Chrome, Firefox, Edge, etc.)

2. **Open Developer Console**:
   - Press `F12` on your keyboard
   - OR Right-click anywhere → "Inspect" → Click "Console" tab
   
3. **Check for Errors**:
   - Look for any RED error messages in the console
   - Common errors to look for:
     - `Cannot read property 'addEventListener' of null` (means button not found)
     - `Uncaught ReferenceError` (means variable not defined)
     - `Uncaught TypeError` (means trying to use something that doesn't exist)

## What Should Happen

### On Page Load
You should see console messages like:
```
switchScreen called: ACTION
Showing ACTION screen
Screen switched successfully
```

### When Clicking "Work at McDonald's"
You should see:
```
doWork called {actionTakenToday: false}
Work complete, new balance: 220
```

Then after 1.5 seconds, the day should end and advance.

### When Clicking "Trade Stocks"
You should see:
```
doTrade called {actionTakenToday: false}
Switching to trade screen
switchScreen called: TRADE
Showing TRADE screen
Screen switched successfully
```

The screen should change to show the market chart.

### When Clicking "Sleep"
You should see:
```
doSleep called {actionTakenToday: false}
Going to sleep
```

Then after 1.5 seconds, the day should end and advance.

## Common Issues and Fixes

### Issue: Buttons don't respond to clicks
**Possible causes**:
1. JavaScript not loading
2. Event listeners not attached
3. Elements not found

**Check**:
- Open console and look for errors
- Type `ui.btnActionWork` in console and press Enter
  - Should show: `<button id="action-work" class="action-card work-card">...</button>`
  - If shows `null` or `undefined`, the button wasn't found

### Issue: "Action already taken today" appears immediately
**Cause**: `state.actionTakenToday` is stuck as `true`

**Fix**:
1. Open console
2. Type: `localStorage.clear()`
3. Press Enter
4. Refresh the page (F5)

### Issue: Screen doesn't change
**Check**:
- Look for console messages starting with "switchScreen called:"
- If you see "Showing TRADE screen" but nothing changes, check CSS

### Issue: Balance doesn't update
**Check**:
- Console should show "Work complete, new balance: XXX"
- Type `state.balance` in console to see current balance
- Type `updateUI()` in console to force UI refresh

## Manual Testing Steps

1. **Test Work Button**:
   - Click "Work at McDonald's"
   - Should see feedback message
   - Balance should increase by $120
   - After 1.5s, should advance to Day 2
   - Daily cost of $30 should be deducted
   - Final balance should be: $100 + $120 - $30 = $190

2. **Test Trade Button**:
   - Click "Trade Stocks"
   - Should switch to market screen
   - Should see price chart
   - Try clicking "BUY" button
   - Try clicking "SELL" button
   - Click "End Day & Pay Costs →"
   - Should return to action screen
   - Should advance to next day

3. **Test Sleep Button**:
   - Click "Sleep"
   - Should see feedback message
   - Balance should NOT increase
   - After 1.5s, should advance to next day
   - Daily cost of $30 should be deducted

4. **Test Game Over**:
   - Keep sleeping or making bad trades
   - Let balance go negative for 3 days
   - Should see game over screen
   - Click "Try Again" to restart

## Report Back

Please open the game and:
1. Open the console (F12)
2. Take a screenshot of any errors
3. Try clicking each button
4. Copy any console messages
5. Let me know what happens!

If you see specific errors, share them and I can fix the exact issue.
