# User Guide: Weekly Goals

The Weekly Goals feature helps you plan production schedules, track shipment performance, and analyze achievement trends over time.

---

## 📍 Accessing Weekly Goals

Click **"Weekly Goals"** in the left sidebar navigation.

---

## 🎯 Overview

The Weekly Goals page has two main modes:

1. **Data Entry** - Set goals and track progress week-by-week
2. **Analytics** - View performance trends, streaks, and insights

---

## 📊 Data Entry Mode

### Default View

When you first open Weekly Goals:
- Shows **16 weeks** of data by default
- **Current week appears in the 3rd position** (with 2 historical weeks above)
- Current week is highlighted in **blue** with a **→** arrow indicator
- Weeks are Monday-to-Sunday (ISO week format)

### Setting Weekly Goals

**To set a goal for a week:**

1. **Select Product:**
   - Use the dropdown at the top: "Product: [Select]"
   - Only shows Finished Goods (products with type = 'finished_good')

2. **Navigate to Desired Week:**
   - Click **"Go to Current Week"** to jump to today
   - Use **"Previous/Next N Weeks"** buttons to scroll
   - Use the **Week Picker** calendar to jump to a specific week
   - Change the view range (4, 8, 12, 16, 26, or 52 weeks)

3. **Enter Goal:**
   - In the **"Goal"** column, type the number of units to ship that week
   - Goal automatically saves after 1.5 seconds (auto-save)
   - You'll see "Auto-saving..." briefly, then "Auto-saved"

4. **Manual Save (Optional):**
   - Click **"Save Now"** button if you want to force immediate save
   - Useful if you made multiple changes and want to ensure they're saved

### Understanding the Table Columns

| Column | Description |
|--------|-------------|
| **Week Starting** | Monday date of the week. Shows "Week of [Date]" format with full date range below. Current week highlighted in blue. |
| **Goal** | Editable field. Enter your shipment target for this week. |
| **Shipped** | Read-only. Calculated from Sales/Shipping entries. Shows actual units shipped. |
| **Daily Goal** | Only shown for current week on weekdays. Shows how many units needed per day to hit the weekly goal based on remaining workdays. |
| **Variance** | Difference between Shipped and Goal. Green (+) if over goal, red (-) if under. |
| **Progress** | Visual progress bar showing % of goal achieved. Green = ≥100%, orange = 80-99%, red = <80%. |
| **Status** | Quick status indicator: "✓ Complete" (≥100%), "△ Close" (80-99%), "✗ Behind" (<80%), "No Goal Set" (goal = 0). |

### Daily Goal Calculation (Current Week Only)

The **Daily Goal** column shows a dynamic target for the current week:

**Formula:**
```
Daily Goal = (Weekly Goal - Shipped So Far) ÷ Workdays Remaining
```

**Example:**
- Weekly Goal: 2,300 units
- Today: Wednesday
- Shipped Monday-Tuesday: 800 units
- Remaining needed: 2,300 - 800 = 1,500 units
- Workdays left: Wed, Thu, Fri = 3 days
- Daily Goal: 1,500 ÷ 3 = 500 units/day

📌 **Note:** Daily goal adjusts automatically as sales are recorded throughout the week!

### Navigation Controls

**Go to Current Week:**
- Resets view to show current week in 3rd position
- Helpful if you've navigated far in the past/future

**Previous/Next N Weeks:**
- Jumps backward/forward by the number of weeks you're viewing
- Example: If viewing 16 weeks, "Next" jumps forward 16 weeks

**Jump to Week (Calendar):**
- Opens a week picker
- Select any week to jump directly to it
- Useful for long-range planning

**View Range Dropdown:**
- Choose how many weeks to display: 4, 8, 12, 16, 26, or 52
- More weeks = better long-term view
- Fewer weeks = easier to focus on near-term

### Summary Statistics (Top Cards)

Four cards show aggregate metrics for the visible weeks:

**Total Goal:**
- Sum of all weekly goals in the current view
- Icon: 🚀

**Total Shipped:**
- Sum of actual shipments
- Green if ≥ Total Goal

**Overall Progress:**
- (Total Shipped ÷ Total Goal) × 100
- Color-coded: Green (≥100%), Orange (80-99%), Red (<80%)

**Weeks On Track:**
- Count of weeks that met/exceeded their goal
- Format: "8 / 12" (8 weeks on track out of 12 total)
- Green if majority on track, red otherwise

---

## 📈 Analytics Mode

Click the **"Analytics"** tab to switch from Data Entry to Analytics.

### Automatic Settings

When you switch to Analytics:
- View automatically changes to **last 12 weeks** (including current week)
- Chart displays with **oldest week on left, newest week on right**
- When you switch back to Data Entry, it restores your previous view settings

### Key Metrics Cards

Four high-level KPIs at the top:

**Achievement Rate:**
- Overall percentage of goals achieved
- Formula: (Total Shipped ÷ Total Goal) × 100
- Shows unit breakdown below: "18,764 / 20,525 units"
- Color: Green (≥100%), Orange (≥90%), Red (<90%)

**Current Streak:**
- Number of consecutive weeks that met goal
- Counts backwards from most recent week
- Shows "Best: X weeks" below (all-time record)
- Icon: 🔥

**Weeks On Target:**
- Count of weeks that met goal (≥100%)
- Format: "3 / 12"
- **Close (90%+):** Count of weeks at 90-99% achievement (shown in orange below)
- Color: Green if ≥50% on target

**Average Weekly Goal:**
- Mean goal across all weeks with goals set
- Shows "Across X weeks" below
- Icon: 🚀

### Performance Trends Chart

**Combined line and bar chart** showing:

**Lines (left Y-axis):**
- Blue line: Weekly goals
- Green line: Actual shipments

**Bars (right Y-axis):**
- Purple bars: Variance (positive = above goal, negative = below)

**X-axis:**
- Week start dates (angled labels)
- Chronological: oldest left → newest right

**Interaction:**
- Hover over any point to see tooltip with:
  - Week date
  - Goal amount
  - Shipped amount
  - Variance (+/-)
  - Achievement percentage

### Monthly Summary Table

Shows performance grouped by calendar month:

| Column | Description |
|--------|-------------|
| **Month** | Calendar month (e.g., "November 2025") |
| **Weeks** | Number of weeks in that month with goals |
| **Total Goal** | Sum of weekly goals for the month |
| **Total Shipped** | Sum of actual shipments |
| **Achievement** | (Shipped ÷ Goal) × 100%, color-coded |

- Sortable by any column
- Default sort: Most recent month first

### Best and Worst Weeks

**Top 5 Best Weeks:**
- Shows weeks with highest achievement rates
- Icon: 🏆 (green)
- Useful for identifying what went right

**Bottom 5 Weeks:**
- Shows weeks with lowest achievement rates
- Icon: ⚠️ (red)
- Useful for identifying problem areas

Both tables show:
- Week date
- Shipped amount
- Goal amount
- Achievement rate (%)

---

## 🔄 Workflow Examples

### Scenario 1: Setting Goals for Next Month

**Goal:** Plan production for the next 4 weeks

1. Click **Data Entry** tab
2. Select your product from dropdown
3. Click **"Next N Weeks"** if needed to see future weeks
4. For each week:
   - Enter goal in the **Goal** column
   - Press Tab or Enter to move to next week
5. Goals auto-save after 1.5 seconds
6. Review the summary cards at top to see total planned units

### Scenario 2: Checking Today's Progress

**Goal:** See if you're on pace to hit this week's goal

1. Click **Data Entry** tab
2. Click **"Go to Current Week"** (if not already there)
3. Look at the current week row (blue highlight):
   - Check **"Shipped"** column - how many shipped so far today
   - Check **"Daily Goal"** column - target for today
   - Check **"Progress"** bar - overall week progress
4. If behind: Determine what's needed to catch up
5. If ahead: Celebrate! 🎉

### Scenario 3: Analyzing Last Quarter Performance

**Goal:** Review 12-week trends and achievement

1. Click **Analytics** tab (auto-loads last 12 weeks)
2. Review **Key Metrics:**
   - Achievement Rate - overall success rate
   - Current Streak - consistency
   - Weeks On Target - how many weeks succeeded
3. Study **Performance Trends Chart:**
   - Look for patterns (dips, peaks, trends)
   - Identify weeks with large variances
4. Check **Monthly Summary:**
   - Compare month-over-month performance
5. Review **Best/Worst Weeks:**
   - Learn from successes
   - Investigate failures
6. Use insights to adjust future goals or processes

### Scenario 4: Bulk Planning for New Product Launch

**Goal:** Set 8 weeks of goals for a new product line

1. Select the new product from dropdown
2. Change view to **8 Weeks**
3. Click **"Go to Current Week"**
4. Enter goals starting with current week:
   - Week 1: Ramp-up (lower goal)
   - Weeks 2-4: Build up
   - Weeks 5-8: Full capacity
5. Auto-save handles all changes
6. Return later to adjust as needed

---

## 💡 Best Practices

### Goal Setting

**Be Realistic:**
- Base goals on historical performance
- Consider capacity constraints
- Account for holidays/downtime

**Weekly Consistency:**
- Try to set goals at least 4-6 weeks out
- Update weekly to maintain rolling forecast
- Adjust goals if circumstances change

**Use Analytics:**
- Review achievement trends monthly
- Adjust goals based on capability
- Don't set goals that are consistently unachievable (demotivating)

### Tracking Progress

**Daily Check-ins:**
- Review "Daily Goal" each morning
- Track progress throughout the day
- Address issues before end of week

**Weekly Reviews:**
- Every Monday: Review last week's performance
- Set/adjust goals for next 4-6 weeks
- Communicate targets to production team

**Monthly Analysis:**
- Switch to Analytics mode
- Review trends and patterns
- Present findings to management
- Adjust strategies as needed

### Communication

**Share with Team:**
- Display dashboard on production floor
- Email weekly goal updates
- Celebrate streaks and achievements

**Escalate Issues:**
- If consistently behind, investigate root causes
- May need to adjust capacity, processes, or goals
- Use variance data to support requests for resources

---

## 🎨 Visual Indicators

### Color Coding

**Progress Status:**
- 🟢 Green: ≥100% (met or exceeded goal)
- 🟠 Orange: 80-99% (close to goal)
- 🔴 Red: <80% (significantly behind)

**Current Week:**
- 🔵 Blue background highlight
- → Arrow indicator before date
- Bold text for date

**Variance:**
- Green text with + for positive variance
- Red text with - for negative variance

### Icons

| Icon | Meaning |
|------|---------|
| 🚀 | Goals/targets |
| ✓ | Complete/success |
| △ | Close/warning |
| ✗ | Behind/failure |
| 🔥 | Streak/momentum |
| 🏆 | Achievement/best |
| ⚠️ | Warning/issue |
| 📅 | Calendar/date |
| 📊 | Analytics/charts |

---

## ⚙️ Technical Details

### Data Source

**Goals:**
- Entered manually by user
- Stored in `weekly_shipments` table
- Unique constraint: one goal per product per week

**Shipped:**
- Calculated from `sales_history` table
- Automatically updated when sales are recorded
- Aggregates all shipments with `sale_date` in the week range

### Week Definition

- Weeks start on **Monday** (ISO 8601 standard)
- Week dates are stored as the Monday date (e.g., "2025-11-17")
- Weeks span Monday 00:00 to Sunday 23:59

### Auto-Save Behavior

- Triggered 1.5 seconds after last edit
- Debounced (resets timer if you keep editing)
- Saves entire dataset for the product
- Shows "Auto-saving..." indicator during save
- Shows "Auto-saved" confirmation when complete

### Daily Goal Calculation Logic

```
IF today is Saturday or Sunday:
  Display "Weekend"
ELSE:
  workdays_remaining = 6 - today.weekday  // Mon=1, Tue=2, etc.
  shipped_before_today = shipped excluding today's shipments
  remaining_needed = goal - shipped_before_today
  daily_goal = remaining_needed / workdays_remaining
```

---

## 🔍 Troubleshooting

### Shipped number doesn't match my records

**Cause:** Sales data might not be entered in Sales/Shipping tab

**Solution:**
1. Go to Sales/Shipping tab
2. Verify all shipments are recorded
3. Check the date ranges
4. Ensure product code matches exactly

### Auto-save not working

**Cause:** Network issue or backend not running

**Solution:**
1. Check backend server is running
2. Try manual save (click "Save Now")
3. Refresh the page
4. Check browser console for errors

### Weekly goals aren't appearing in Material Analysis

**Cause:** MRP calculation might be cached

**Solution:**
1. Go to Dashboard
2. Click "Calculate MRP" button
3. Return to Material Analysis to see updated projections

### Current week not highlighted

**Cause:** Clock/date settings incorrect

**Solution:**
1. Verify system date/time is correct
2. Check timezone settings
3. Refresh the page

### Analytics chart shows no data

**Cause:** No goals have been set yet

**Solution:**
1. Switch to Data Entry mode
2. Set goals for at least 2-3 weeks
3. Record some shipments
4. Return to Analytics

---

## 🚀 Advanced Tips

### Keyboard Navigation

While in a Goal input field:
- **Tab** - Move to next week's goal
- **Shift+Tab** - Move to previous week's goal
- **Enter** - Save and stay on current field

### Copying Goals

To duplicate a goal to multiple weeks:
1. Enter goal for first week
2. Select and copy the number (Ctrl+C)
3. Click on next week's Goal field
4. Paste (Ctrl+V)
5. Repeat for additional weeks

### Exporting Data

While analytics provide good visualizations, you can also:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run: `copy(JSON.stringify(shipmentData))`
4. Paste into Excel or data analysis tool

### Custom Date Ranges

For custom analysis periods:
1. Use Data Entry mode
2. Adjust "View" dropdown (4-52 weeks)
3. Use "Jump to Week" calendar
4. Take screenshots or print page for reports

---

## 📞 Related Documentation

- **[Sales/Shipping Guide](07_USER_GUIDE_SALES.md)** - How shipments are recorded
- **[Material Analysis Guide](10_USER_GUIDE_MATERIAL_ANALYSIS.md)** - How goals drive component planning
- **[Dashboard Guide](04_USER_GUIDE_DASHBOARD.md)** - Overview metrics
- **[API Reference](13_API_REFERENCE.md)** - For automated goal setting via API

---

*Master production planning with Weekly Goals! Next: [Purchase Orders →](09_USER_GUIDE_PURCHASE_ORDERS.md)*
