# Team Leader Metrics Refactor (V2)

The previous attempt failed because it leaned too heavily on the team's task completion, allowing leaders who did zero actual review work (but whose teams completed 1 easy task) to become the Topper. You were completely right to revert it—that wasn't fair play.

To fix both the **negative scores** and the **unfair "1-task Topper" advantage**, we need to calculate a true **Leadership Performance Score** based on their actual review actions.

## The Core Problems Solved
1. **The Negative Score Problem**: Previously, a flat `-10` penalty per late task meant a leader with 15 late tasks got `-150%`. 
   *Solution*: We will use a standard percentage: **On-Time Review Rate (OTRR)**. `(On-Time Reviews / Total Reviews) * 100`. It will strictly be between 0% and 100%.
2. **The "1-Task Topper" Problem**: A leader who gets 1 task and reviews it on time gets 100%, beating a leader who reviews 45 out of 50 tasks on time (90%).
   *Solution*: **Bayesian Volume Weighting** (The same math IMDB uses to rank top movies). We add "dummy" tasks at the company average to everyone's score. This pulls low-volume leaders down to the average, while high-volume leaders overpower the dummy tasks with their real work. 

## Proposed Changes

### 1. Backend (`src/actions/dashboard.ts`)
We will rewrite the TL metrics loop for both Monthly and Yearly actions:
- Calculate `totalReviewsDue` and `onTimeReviews`.
- If a leader has `0` tasks, their score is strictly `null` (N/A) so they CANNOT be the Topper.
- Calculate **Bayesian OTRR**. Formula: `((OnTimeReviews + 2) / (TotalReviewsDue + 2.5)) * 100`. (This mathematically guarantees that a leader with 1/1 task gets ~85%, while a leader with 20/20 tasks gets ~97%).
- **Final Leadership Score** = `(Bayesian OTRR * 0.7) + (DeptPunctuality * 0.3)`.

### 2. Frontend (`src/components/features/admin/reports-client.tsx`)
- Revert the table columns back to a simpler view: `Review Queue`, `On-Time Review Rate`, `Dept Punctuality`, and `Leadership Score`.
- Update the **Formula Reference Popover** to clearly explain the Bayesian smoothing so that employees understand why 1/1 task does not equal 100%.
- Ensure the `tlOfTheMonth` is strictly sorted by the new `Leadership Score`.

## User Review Required
> [!IMPORTANT]
> How does this approach sound? By using a Bayesian average, a leader MUST handle a high volume of tasks efficiently to reach 95%+. A leader with only 1 or 2 tasks can never mathematically exceed ~85%, eliminating the unfair advantage entirely. If you approve, I will implement this immediately.
