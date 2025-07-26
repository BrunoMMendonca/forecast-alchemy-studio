# Chart.js Infinite Trend Lines: Robust Recipe

This guide details the **robust solution for drawing infinite (but visually clipped) trend lines in Chart.js** that do not disturb zoom, pan, or axis scaling. Use this as a reference for future implementations.

---

## **Key Principles**
- **Trend lines should not expand the chart's axis limits.**
- **Trend lines should always be clipped to the visible chart area.**
- **No performance degradation or infinite render loops.**

---

## **Step-by-Step Solution**

### 1. **Draw Trend Lines as Annotations**
Use the Chart.js annotation plugin to draw trend lines as `type: 'line'` annotations.

### 2. **Prevent Annotations from Affecting Axis Limits**
When creating the annotation, set:
```js
clip: true, // Critical!
xMin: null,
xMax: null,
yMin: null,
yMax: null,
```
This ensures Chart.js does **not** expand the axis to fit the annotation.

### 3. **Dynamically Calculate Endpoints**
After the chart is updated (scales are ready), calculate where the trend line intersects the current visible y-axis limits.
For each trend line:
- Compute the slope and intercept.
- Find the x-values where the line crosses `yMin` and `yMax`:
  ```js
  xAtYMin = (yMin - intercept) / slope
  xAtYMax = (yMax - intercept) / slope
  ```
- Clamp these x-values to the visible x-axis range.
- Set the annotation's `xMin`, `xMax`, `yMin`, `yMax` to these intersection points.

### 4. **Use a Chart.js Plugin with `afterUpdate`**
Register a custom plugin:
```js
const trendLineFitPlugin = {
  id: 'trendLineFitPlugin',
  afterUpdate: (chart) => {
    const xAxis = chart.scales.x;
    const yAxis = chart.scales.y;
    trendLines.forEach(line => {
      const slope = (line.endValue - line.startValue) / (line.endIndex - line.startIndex);
      const intercept = line.startValue - slope * line.startIndex;
      let xAtYMin = slope !== 0 ? (yAxis.min - intercept) / slope : xAxis.min;
      let xAtYMax = slope !== 0 ? (yAxis.max - intercept) / slope : xAxis.max;
      xAtYMin = Math.max(xAxis.min, Math.min(xAxis.max, xAtYMin));
      xAtYMax = Math.max(xAxis.min, Math.min(xAxis.max, xAtYMax));
      const [finalXMin, finalXMax] = xAtYMin < xAtYMax ? [xAtYMin, xAtYMax] : [xAtYMax, xAtYMin];
      const annotation = chart.options.plugins.annotation.annotations[`trendLine${line.id}`];
      annotation.xMin = finalXMin;
      annotation.yMin = slope * finalXMin + intercept;
      annotation.xMax = finalXMax;
      annotation.yMax = slope * finalXMax + intercept;
    });
  }
}
```
Pass this plugin to the chart via the `plugins` prop.

### 5. **No chart.update() in the Plugin**
Do **not** call `chart.update()` inside the plugin, to avoid infinite loops.

### 6. **(Optional) Debug Panel**
For debugging, display the current axis limits and annotation endpoints under the chart.

---

## **What to Avoid**
- Do **not** set annotation endpoints to values far outside the data range (e.g., `-100`, `chartData.length + 100`) on creation.
- Do **not** call `chart.update()` inside a plugin or afterDraw/afterUpdate.
- Do **not** rely on storing axis limits before drawing; always use the current chart scales in the plugin.

---

## **Minimal Working Example (Pseudocode)**

```js
// 1. Annotation creation
annotations: {
  ...trendLines.reduce((acc, line) => ({
    ...acc,
    [`trendLine${line.id}`]: {
      type: 'line',
      xMin: null,
      xMax: null,
      yMin: null,
      yMax: null,
      borderColor: '#f59e0b',
      borderWidth: 2,
      borderDash: [2, 2],
      clip: true,
      display: true,
      drawTime: 'afterDatasetsDraw',
    }
  }), {})
}

// 2. Plugin
const trendLineFitPlugin = {
  id: 'trendLineFitPlugin',
  afterUpdate: (chart) => {
    const xAxis = chart.scales.x;
    const yAxis = chart.scales.y;
    trendLines.forEach(line => {
      const slope = (line.endValue - line.startValue) / (line.endIndex - line.startIndex);
      const intercept = line.startValue - slope * line.startIndex;
      let xAtYMin = slope !== 0 ? (yAxis.min - intercept) / slope : xAxis.min;
      let xAtYMax = slope !== 0 ? (yAxis.max - intercept) / slope : xAxis.max;
      xAtYMin = Math.max(xAxis.min, Math.min(xAxis.max, xAtYMin));
      xAtYMax = Math.max(xAxis.min, Math.min(xAxis.max, xAtYMax));
      const [finalXMin, finalXMax] = xAtYMin < xAtYMax ? [xAtYMin, xAtYMax] : [xAtYMax, xAtYMin];
      const annotation = chart.options.plugins.annotation.annotations[`trendLine${line.id}`];
      annotation.xMin = finalXMin;
      annotation.yMin = slope * finalXMin + intercept;
      annotation.xMax = finalXMax;
      annotation.yMax = slope * finalXMax + intercept;
    });
  }
}

// 3. Pass plugin to chart
<Line data={...} options={...} plugins={[trendLineFitPlugin]} />
```

---

## **Summary Checklist**
- [x] Use `clip: true` on annotations.
- [x] Set endpoints to `null` on creation.
- [x] Use a plugin with `afterUpdate` to set endpoints based on current scales.
- [x] Never call `chart.update()` in the plugin.
- [x] Use current chart scales for intersection math.

---

**If you follow these steps, you'll have robust, infinite, non-disturbing trend lines that work with any zoom/pan and never break the chart!** 