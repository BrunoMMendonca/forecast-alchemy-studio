Workflow Summary
Step 1: Upload (Finished/Adjustments allowed)
    User uploads sales data via CSV. 

Step 2: Clean and Prepare (Finished/Adjustments allowed)
    User reviews and optionally edits/cleans data (outlier detection, manual edits).
    User can go back and forth between “Clean and Prepare” and “Explore”.

Step 3: Explore (Finished/Adjustments allowed)
    User visually inspects cleaned data, aggregates, trends, etc.
    Can return to “Clean and Prepare” if needed.

Step 4: Forecast (Ongoing)
    Optimize (Ongoing)
        Optimization is the act of adjusting the parameters of the model to get the best forecast.
        "Select SKU" dropdown is available for navigation.
        Automatic optimization starts in the background as soon as new data is uploaded (in Step 1) or relevant changes are made (in Step 2) or in Settings.
        Only SKUs that have changed are re-optimized (minimizing unnecessary work and API calls).
        Three optimization methods:
            Grid: Try parameter combinations, pick the best for each model/SKU.
            AI: Use GROK-3 to review grid results and propose improvements (if enabled).
            Manual (mode): User can adjust parameters per model/SKU (default to grid results).
        User can see which SKUs/models are already optimized (and by which method AI/GRID), queued, or in progress.
        User can manually adjust parameters (Manual mode), but cannot trigger optimization directly.
        The user can pick the best model for each SKU. An automatic model selection happens but the user can override it.

    Tune (Barely started)
        "Select SKU" dropdown is available for navigation.
        With a model selected for each SKU, a "final" single forecast per SKU can be shown to the user. This forecast is shown toghether with the cleaned historical data.
        The user can manually adjust the values of each time period for the forecast (and obviously not the historical data). This screen should be visually similar to the "Clean and Prepare" screen but instead of adjusting the historical data, the user can adjust the forecast.
        An AI chat is available to the user to help them adjust the forecast. Things like "I want to increase the forecast of SKU X/AggregatableField Y for the next 3 months by 10%" or "We won't be selling this product from next month on. Please adjust the forecast accordingly", should be possible.


Settings
    Forecast Periods can be set in general settings and represent the number of time periods in the future that the user wants to forecast.
    AI optimization (GROK-3) can be enabled/disabled in general settings.






