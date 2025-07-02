import { BaseModel } from './BaseModel.js';

export class HoltWinters extends BaseModel {
  static metadata = {
    id: 'holt-winters',
    displayName: 'Holt-Winters',
    parameters: [
      { name: 'alpha', type: 'number', default: 0.3, visible: true, label: 'Level Smoothing (alpha)', description: 'Controls the smoothing of the level component.' },
      { name: 'beta', type: 'number', default: 0.1, visible: true, label: 'Trend Smoothing (beta)', description: 'Controls the smoothing of the trend component.' },
      { name: 'gamma', type: 'number', default: 0.1, visible: true, label: 'Seasonal Smoothing (gamma)', description: 'Controls the smoothing of the seasonal component.' },
      { name: 'type', type: 'select', default: 'additive', visible: true, label: 'Seasonal Type', description: 'Type of seasonality (additive or multiplicative).', options: [
        { value: 'additive', label: 'Additive' },
        { value: 'multiplicative', label: 'Multiplicative' }
      ] },
    ],
    get defaultParameters() {
      return Object.fromEntries(this.parameters.map(p => [p.name, p.default]));
    },
    optimizationParameters: { alpha: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], beta: [0.01, 0.05, 0.1, 0.15, 0.2], gamma: [0.01, 0.05, 0.1, 0.15, 0.2], type: ['additive', 'multiplicative'] },
    isSeasonal: true,
    className: 'HoltWinters',
    enabled: true
  };

  constructor(parameters = HoltWinters.metadata.defaultParameters, seasonLength = 12) {
    super(parameters);
    this.name = 'Holt-Winters';
    this.alpha = parameters.alpha || 0.3;
    this.beta = parameters.beta || 0.1;
    this.gamma = parameters.gamma || 0.1;
    this.seasonLength = seasonLength; // Set from settings/frequency
    this.type = parameters.type || 'additive'; // 'additive' or 'multiplicative'
    
    this.level = null;
    this.trend = null;
    this.seasonal = [];
    this.trained = false;
  }

  train(data) {
    if (!data || data.length < this.seasonLength * 2) {
      throw new Error(`Training data must have at least 2 seasons (${this.seasonLength * 2} observations)`);
    }
    
    const values = data.map(d => {
      if (typeof d === 'object') {
        return d.sales || d.Sales || d.value || d.amount || d;
      }
      return d;
    });
    
    this._initialize(values);
    
    for (let i = this.seasonLength; i < values.length; i++) {
      const prevLevel = this.level;
      const prevTrend = this.trend;
      const seasonIndex = i % this.seasonLength;
      
      if (this.type === 'additive') {
        this.level = this.alpha * (values[i] - this.seasonal[seasonIndex]) + (1 - this.alpha) * (prevLevel + prevTrend);
        this.trend = this.beta * (this.level - prevLevel) + (1 - this.beta) * prevTrend;
        this.seasonal[seasonIndex] = this.gamma * (values[i] - this.level) + (1 - this.gamma) * this.seasonal[seasonIndex];
      } else { // multiplicative
        this.level = this.alpha * (values[i] / this.seasonal[seasonIndex]) + (1 - this.alpha) * (prevLevel + prevTrend);
        this.trend = this.beta * (this.level - prevLevel) + (1 - this.beta) * prevTrend;
        this.seasonal[seasonIndex] = this.gamma * (values[i] / this.level) + (1 - this.gamma) * this.seasonal[seasonIndex];
      }
    }
    
    this.trained = true;
    return this;
  }
  
  _initialize(values) {
    // Initial level is the average of the first season
    this.level = values.slice(0, this.seasonLength).reduce((sum, val) => sum + val, 0) / this.seasonLength;

    // Initial trend is the average difference between first two seasons
    let trendSum = 0;
    for (let i = 0; i < this.seasonLength; i++) {
        trendSum += (values[i + this.seasonLength] - values[i]);
    }
    this.trend = trendSum / (this.seasonLength * this.seasonLength);

    // Initial seasonal components
    const seasonAverages = [];
    const numSeasons = Math.floor(values.length / this.seasonLength);
    for(let j=0; j<numSeasons; j++){
        seasonAverages.push(values.slice(j * this.seasonLength, (j+1) * this.seasonLength).reduce((a,b)=>a+b,0) / this.seasonLength);
    }
    
    const initialSeasonalFactors = new Array(this.seasonLength).fill(0);
    for(let i=0; i<this.seasonLength; i++){
        let sumOfVals = 0;
        for(let j=0; j<numSeasons; j++){
            if(this.type === 'additive'){
                sumOfVals += values[this.seasonLength*j+i] - seasonAverages[j];
            } else { // multiplicative
                sumOfVals += values[this.seasonLength*j+i] / seasonAverages[j];
            }
        }
        initialSeasonalFactors[i] = sumOfVals / numSeasons;
    }
    this.seasonal = initialSeasonalFactors;
  }

  predict(periods) {
    if (!this.trained) {
      throw new Error('Model must be trained before making predictions');
    }

    const predictions = [];
    let currentLevel = this.level;
    let currentTrend = this.trend;

    for (let i = 1; i <= periods; i++) {
      const seasonIndex = (this.seasonLength + (i - 1)) % this.seasonLength;
      let prediction;

      if (this.type === 'additive') {
        prediction = currentLevel + i * currentTrend + this.seasonal[seasonIndex];
      } else { // multiplicative
        prediction = (currentLevel + i * currentTrend) * this.seasonal[seasonIndex];
      }
      predictions.push(prediction > 0 ? prediction : 0);
    }
    
    return predictions;
  }
  
  validate(testData) {
    if (!this.trained) {
      throw new Error('Model must be trained before validation');
    }

    const values = testData.map(d => {
      if (typeof d === 'object') {
        return d.sales || d.Sales || d.value || d.amount || d;
      }
      return d;
    });
    const predictions = this.predict(values.length);
    
    const mape = this.calculateMAPE(values, predictions);
    const rmse = this.calculateRMSE(values, predictions);
    const mae = this.calculateMAE(values, predictions);
    
    return {
      mape, rmse, mae,
      accuracy: Math.max(0, 100 - mape),
      predictions,
      actual: values
    };
  }
  
  calculateMAPE(actual, predicted) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }
    return count > 0 ? (sum / count) * 100 : 0;
  }

  calculateRMSE(actual, predicted) {
    let sum = 0;
    for (let i = 0; i < actual.length; i++) {
      sum += Math.pow(actual[i] - predicted[i], 2);
    }
    return Math.sqrt(sum / actual.length);
  }

  calculateMAE(actual, predicted) {
    let sum = 0;
    for (let i = 0; i < actual.length; i++) {
      sum += Math.abs(actual[i] - predicted[i]);
    }
    return sum / actual.length;
  }
  
  setParameters(parameters) {
    super.setParameters(parameters);
    this.alpha = parameters.alpha || this.alpha;
    this.beta = parameters.beta || this.beta;
    this.gamma = parameters.gamma || this.gamma;
    this.seasonLength = parameters.seasonLength || this.seasonLength;
    this.type = parameters.type || this.type;
  }
} 