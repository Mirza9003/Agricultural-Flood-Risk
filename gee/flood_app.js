/***************************************************************************************
Title: Flood Susceptibility Mapping in Iowa using Machine Learning and Explainable GeoAI
Author: Mirza Md Tasnim Mukarram
Affiliation: School of Earth, Environment and Sustainability, University of Iowa, USA
Contact: mtasnimmukarram@uiowa.edu
Repository: https://github.com/Mirza9003/Flood-Hazard-Mapping-

License: MIT License

Citation:
If you use this code, data, or application in academic work, please cite:

Mukarram, M.M.T. (2026). Flood Susceptibility Mapping in Iowa using GeoAI.
GitHub Repository: https://github.com/Mirza9003/Flood-Hazard-Mapping-

BibTeX:
@software{Mukarram_FloodGeoAI_2026,
  author  = {Mukarram, Mirza Md Tasnim},
  title   = {Flood Susceptibility Mapping in Iowa using GeoAI},
  year    = {2026},
  url     = {https://github.com/Mirza9003/Flood-Hazard-Mapping-},
  note    = {Google Earth Engine application and machine learning workflows}
}

Disclaimer:
This software is provided "as is", without warranty of any kind. The author is not
responsible for misuse, misinterpretation, or policy decisions based on derived outputs.

***************************************************************************************/
// ==========================
// 1. Load Iowa boundary and counties
// ==========================
var iowa = ee.FeatureCollection("TIGER/2018/States")
              .filter(ee.Filter.eq('NAME', 'Iowa'));

var counties = ee.FeatureCollection("TIGER/2018/Counties")
                  .filter(ee.Filter.eq('STATEFP', '19'));  // Iowa FIPS = 19

// ==========================
// 2. Load uploaded flood susceptibility rasters
// ==========================
var fsm_xgb  = ee.Image("projects/ee-phdstudentuiowa/assets/XGBoostlayer");
var fsm_lgbm = ee.Image("projects/ee-phdstudentuiowa/assets/LGBLayer");
var fsm_hgb  = ee.Image("projects/ee-phdstudentuiowa/assets/HGBlayer");

// ==========================
// 3. Visualization (FSM style colors)
// ==========================
var visParams = {
  min: 1, max: 5,
  palette: [
    '#006400', // Very Low
    '#7FFF00', // Low
    '#FFFF00', // Moderate
    '#FFA500', // High
    '#FF0000'  // Very High
  ]
};

// County outline style
var countyOutline = counties.style({
  color: '000000',  // black outline
  width: 2,
  fillColor: '00000000' // transparent fill
});

// ==========================
// 4. Create a new map instance
// ==========================
var myMap = ui.Map();
myMap.setControlVisibility(true);
myMap.centerObject(iowa, 7);

// Base layers (clipped later dynamically)
var xgbLayer = ui.Map.Layer(fsm_xgb.clip(iowa), visParams, 'FSM XGBoost', true);
var lgbmLayer = ui.Map.Layer(fsm_lgbm.clip(iowa), visParams, 'FSM LightGBM', false);
var hgbLayer  = ui.Map.Layer(fsm_hgb.clip(iowa), visParams, 'FSM HGB', false);
var countyLayer = ui.Map.Layer(countyOutline, {}, 'County Boundaries', true);

myMap.layers().add(xgbLayer);
myMap.layers().add(lgbmLayer);
myMap.layers().add(hgbLayer);
myMap.layers().add(countyLayer);

// ==========================
// 5. Function to make pie chart for a county
// ==========================
function makePieChart(image, county, label) {
  var stats = image.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: county.geometry(),
    scale: 30,
    maxPixels: 1e13
  });

  var bandName = image.bandNames().get(0);
  var hist = ee.Dictionary(stats.get(bandName));

  return ui.Chart.array.values(hist.values(), 0, hist.keys())
           .setChartType('PieChart')
           .setOptions({
              title: label + ' - ' + county.get('NAME').getInfo(),
              colors: ['#006400','#7FFF00','#FFFF00','#FFA500','#FF0000'],
              legend: {position: 'right'}
           });
}

// ==========================
// 6. Build Left Panel (controls + legend + charts)
// ==========================
var leftPanel = ui.Panel({
  style: {width: '250px', padding: '8px'}
});

leftPanel.add(ui.Label('Flood Susceptibility Viewer – Iowa', 
  {fontWeight: 'bold', fontSize: '14px', margin: '0 0 8px 0'}));

// County dropdown
var countyList = counties.aggregate_array('NAME').distinct().sort();
var countySelect = ui.Select({
  items: countyList.getInfo(),
  placeholder: 'Select a county',
  style: {stretch: 'horizontal'}
});
leftPanel.add(ui.Label('Select a county to view charts:', {fontSize: '12px'}));
leftPanel.add(countySelect);

// Add Pie Chart Panel
var chartPanel = ui.Panel();
leftPanel.add(chartPanel);

// Dropdown onChange
countySelect.onChange(function(selected) {
  var county = counties.filter(ee.Filter.eq('NAME', selected)).first();
  myMap.centerObject(county);

  // Mask layers to selected county
  xgbLayer.setEeObject(fsm_xgb.clip(county));
  lgbmLayer.setEeObject(fsm_lgbm.clip(county));
  hgbLayer.setEeObject(fsm_hgb.clip(county));

  // Clear old charts and add new ones
  chartPanel.clear();
  chartPanel.add(makePieChart(fsm_xgb, county, 'XGBoost'));
  chartPanel.add(makePieChart(fsm_lgbm, county, 'LightGBM'));
  chartPanel.add(makePieChart(fsm_hgb, county, 'HGB'));
});

// Layer toggles
leftPanel.add(ui.Label('Toggle Model Layers:', {fontWeight: 'bold', margin: '8px 0 4px 0'}));
leftPanel.add(ui.Checkbox('Show XGBoost', true, function(checked) {
  xgbLayer.setShown(checked);
}));
leftPanel.add(ui.Checkbox('Show LightGBM', false, function(checked) {
  lgbmLayer.setShown(checked);
}));
leftPanel.add(ui.Checkbox('Show HGB', false, function(checked) {
  hgbLayer.setShown(checked);
}));
leftPanel.add(ui.Checkbox('Show County Boundaries', true, function(checked) {
  countyLayer.setShown(checked);
}));

// Legend
leftPanel.add(ui.Label('Legend', {fontWeight: 'bold', margin: '10px 0 4px 0'}));
var labels = ['Very Low Flood','Low Flood','Moderate Flood','High Flood','Very High Flood'];
var colors = ['#006400','#7FFF00','#FFFF00','#FFA500','#FF0000'];

for (var i = 0; i < labels.length; i++) {
  leftPanel.add(ui.Panel([
    ui.Label('', { 
      backgroundColor: colors[i], 
      padding: '8px', 
      margin: '0', 
      border: '1px solid black',
      width: '20px'
    }),
    ui.Label(labels[i], {margin: '0 0 0 6px', fontSize: '12px'})
  ], ui.Panel.Layout.Flow('horizontal')));
}

// About Section
leftPanel.add(ui.Label('About', {fontWeight: 'bold', margin: '10px 0 4px 0'}));
leftPanel.add(ui.Label('Prepared By: Mirza Md Tasnim Mukarram'));
leftPanel.add(ui.Label('University of Iowa, USA'));
leftPanel.add(ui.Label('Email: mtasnimmukarram@uiowa.edu'));
leftPanel.add(ui.Label('Projection: WGS 1984'));

// ==========================
// 7. Title Panel (Top-Center)
// ==========================
var titlePanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    position: 'top-center',
    padding: '10px',
    backgroundColor: '#FFA500', // Orange background
    border: '2px solid black',
    borderRadius: '8px',
    stretch: 'horizontal'
  }
});

// Shared style for subtitles
var titleLabelStyle = {
  backgroundColor: 'rgba(0,0,0,0)', // Transparent via RGBA
  fontSize: '14px',
  color: 'black',
  textAlign: 'center',
  stretch: 'horizontal',
  margin: '0px'
};

// Main Title
var titleLabel = ui.Label({
  value: 'Advancing Flood Risk Assessment with Machine Learning & Explainable GeoAI: Insights from Midwest US',
  style: {
    fontWeight: 'bold',
    fontSize: '16px',
    color: 'black',
    backgroundColor: '#FFA500',  // ✅ FIXED: Match panel background
    textAlign: 'center',
    stretch: 'horizontal',
    margin: '0px'
  }
});

// Subtitles
var subtitle1 = ui.Label({
  value: 'Flood Susceptibility of Iowa at county level based on XGBoost, LightGBM, and HGB models',
  style: titleLabelStyle
});

var subtitle2 = ui.Label({
  value: 'Prepared by: Mirza Md Tasnim Mukarram,School of Earth, Environment and Sustainability University of Iowa',
  style: titleLabelStyle
});

// Add all to the panel
titlePanel.add(titleLabel);
titlePanel.add(subtitle1);
titlePanel.add(subtitle2);

// ==========================
// 8. Assemble UI (Proper Layout – Title Centered Above Map)
// ==========================
ui.root.clear();

// Wrap the title panel and map panel vertically
var layout = ui.Panel({
  widgets: [
    titlePanel, // Add title once, only here
    ui.SplitPanel({
      firstPanel: leftPanel,
      secondPanel: myMap,
      orientation: 'horizontal',
      wipe: false,
      style: {stretch: 'both'}
    })
  ],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    stretch: 'both',
    width: '100%',
    height: '100%',
    padding: '0px'
  }
});

// Add to root
ui.root.add(layout);

