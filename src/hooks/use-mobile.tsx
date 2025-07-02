[useBestResultsMapping] No results for models: 
(4) ['holt-winters', 'seasonal-moving-average', 'arima', 'sarima']
0
: 
"holt-winters"
1
: 
"seasonal-moving-average"
2
: 
"arima"
3
: 
"sarima"
length
: 
4
[[Prototype]]
: 
Array(0)
 for SKU: 95000000 filePath: uploads/Original_CSV_Upload-1751389308129-e6e71ef3-processed.json
ForecastEngine.tsx:303 [ForecastEngine] UI has received and acknowledged all available model results: 
(3) [{…}, {…}, {…}]
0
: 
{modelType: 'simple-exponential-smoothing', displayName: 'Simple Exponential Smoothing', category: 'Unknown', description: '', isSeasonal: false, …}
1
: 
{modelType: 'holt-linear-trend', displayName: "Holt's Linear Trend", category: 'Unknown', description: '', isSeasonal: false, …}
2
: 
{modelType: 'moving-average', displayName: 'Simple Moving Average', category: 'Unknown', description: '', isSeasonal: false, …}
length
: 
3
[[Prototype]]
: 
Array(0)import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
