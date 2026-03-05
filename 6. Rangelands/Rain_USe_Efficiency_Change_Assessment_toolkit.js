/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var Enjipai = ee.FeatureCollection("projects/ee-theonlyhayden/assets/Enjipai_PA_Dated_V2");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
/* This script is designed to calculate the change in Rain use efficiency (RUE) over time. 
 - RUE is calculated as the maximum vegetation index (default: soil adjusted vegetation index - SAVI) values for a year, divided by the annual rainfall received.
 - As it is expected that there will be an improvement in RUE over time, the script sets the baseline as 5 years prior to the project start date
and then calculates the RUE annually from that start date to present. It then fits a simple linear regression to the time series.
 - The RAW RUE values are calculated for each polygon and are exported to google drive.

A simple Z-score is also calculated to determine what portion of the project region has experienced a significant shift in RUE since project implementation

Notes: 1.) Not all the polygons have a project start date - as such we are filtering the featureCollection to only include polygons with a date.
       As additional areas are brought online the project polygons can be updated to include them.
       2.) To facilitate data exploration and point checks, there is a function built in where you can selectively visualize specific villages - simply set the village variable to the appropriate village name from the input polygons
       3.) Create a seperate plot showing SAVI values and Rainfall
       4.) Option B - Display changes in RUE in relation to a wider reference region. - use VM0047 Methodology
       5.) Look at shorter time series - Monthly?
       6.) Terraclimate
       



*/

var village =  'Mbaash'
// other names for villages as input for above: ['Mbaash', 'Selela','Sukuro','Terrat','Engikaret','Ranch','Engaruka Chini',''Engaruka Juu','Irerendeni','Kiserian','Kitiangare','Kitwai A','Kitwai B','Lesingita','Lossimingori','Oldonyo Lengai','Mundarara']

var AOI = Enjipai.filter(ee.Filter.neq('Project_St', null))

Map.addLayer(AOI, {}, 'Project Polygons',false);

var prcp = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY");

var dataset = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
                  .filter(ee.Filter.date('2025-01-01', '2025-12-31'));

var precipitation = dataset.select('precipitation').sum();
var precipitationVis = {
  min: 1,
  max: 900,
  palette: ['001137', '0aab1e', 'e7eb05', 'ff4a2d', 'e90000'],
};

Map.addLayer(precipitation, precipitationVis, 'Precipitation');



//Creates the time series as features
var RUE_col = AOI.map(function(feat){
  var currentDate = ee.Date(Date.now()).advance(-1,'year').get('year');
  var proj_start_date = ee.Date(feat.get('Project_St'))
  var monitoring_start_date = proj_start_date.advance(-5,'year')
  var baselineStartyear = monitoring_start_date.get('year')
  var baselineEndyear = proj_start_date.get('year')
  var yearsList =  ee.List.sequence(baselineStartyear, currentDate, 1);
  var test = yearsList.map(function(li){
    var year = ee.Number(li).subtract(2000).int();
    var start = ee.Date.parse('YYYY', ee.String(ee.Number(li).int()));
    var end = start.advance(1, 'year');
    var anppImg = getL8(feat,start,end).select('SAVI')
    var precipImg = ee.Image(prcp.filterDate(start, end).map(function(img){
      return img.resample('bilinear')}).sum()).float();
    return anppImg
                  .divide(precipImg)
                  .multiply(10000)
                  .float()
                  .rename(['RUE'])
                  .set('year',year.add(2000))})
  var TS = test.map(function(img){
    var image = ee.Image(img)
    var Avg = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: feat.geometry(),
      scale:500,
      maxPixels: 1e13,
      tileScale:4})
    return Avg.get('RUE')})
  return feat.set('RUE',TS)
})

print('List of all Villages Rain use efficiency over time:',RUE_col)

// Visualization - If there is a specific Village Name that we wish to visualize
var features = AOI.filter(ee.Filter.eq('VillageNam',village))
Map.centerObject(features,10)
Map.addLayer(features, {}, village)

var currentDate = ee.Date(Date.now()).advance(-1,'year').get('year'); 
var proj_start_date = ee.Date(features.first().get('Project_St'))
var monitoring_start_date = proj_start_date.advance(-5,'year')
var baselineStartyear = monitoring_start_date.get('year')
var baselineEndyear = proj_start_date.get('year')
var yearsList =  ee.List.sequence(baselineStartyear, currentDate, 1); 

var test = yearsList.map(function(li){
    var year = ee.Number(li).subtract(2000).int();
    var start = ee.Date.parse('YYYY', ee.String(ee.Number(li).int()));
    var end = start.advance(1, 'year');
    var anppImg = getL8(features,start,end).select('SAVI')
    var precipImg = ee.Image(prcp.filterDate(start, end).map(function(img){
      return img.resample('bilinear');
    }).sum()).float();
  return anppImg
            .divide(precipImg)
            .multiply(10000)
            .float()
            .rename(['RUE'])
            .set('year',year.add(2000))
})

var date1 = ee.Image(test.get(0)).clip(features)
var date2 = ee.Image(test.get(test.length().subtract(1))).clip(features)

var baseline = ee.ImageCollection(test.filter(ee.Filter.lte('year', proj_start_date.get('year'))))
    .reduce(ee.Reducer.mean().combine(ee.Reducer.stdDev(), null, true))
    .rename(['mean', 'stdDev']);

var current = date2
    
var zScore = current.subtract(baseline.select('mean'))
    .divide(baseline.select('stdDev'))
    .rename('Zscore');

Map.addLayer(date1,{min:0, max:12, palette:['red','orange','yellow','green','blue']}, 'Baseline_start',false)
Map.addLayer(date2,{min:0, max:12, palette:['red','orange','yellow','green','blue']}, 'Current',false)
Map.addLayer(zScore,{min:-3, max:3, palette: ['red','orange','yellow','green','blue']},'Z - Score - RAW',false)

Map.addLayer(zScore.lte(-1).selfMask(),{min: 0 , max:1, palette: ['red']},'Significant Degradation')
Map.addLayer(zScore.gte(1).selfMask(),{min: 0 , max:1, palette: ['green']},'Significant Improvement')

// Gather data for charting

print('Charting data for:', village)
var TS = ee.List(ee.Feature(RUE_col.filter(ee.Filter.eq('VillageNam',village)).first()).get('RUE'))
var indexList = ee.List.sequence(0,ee.Number(TS.size()).subtract(1),1)

var chartCollection = ee.FeatureCollection(indexList.map(function(x) {
  return ee.Feature(null, {
    'year': yearsList.get(ee.Number(x)),
    'RUE': TS.get(ee.Number(x))
  });
}));

var chart = ui.Chart.feature.byFeature(chartCollection, 'year', 'RUE').setChartType('ColumnChart').setOptions({
    title: 'Rain Use Efficiency by year ' + village,
    hAxis: {title: 'year',format: '0'},
    vAxis: {title: 'RUE',format: '0.00000'},
    pointSize: 3,
    trendlines: { 0: {showR2: true, visibleInLegend: true, color: 'green'}}});

print(chart);

var export_data = RUE_col.map(function(x){
  return ee.Feature(null, {
    'projectStartYear': ee.Date(x.get('Project_St')).get('year'),
    'baselineStartYear': ee.Date(x.get('Project_St')).advance(-5,'year').get('year'),
    'Name': x.get('VillageNam'),
    'mean_RUE': x.get('RUE')
  });
})

print('Export Data:',export_data)

Export.table.toDrive({collection:export_data, description:'Enjipai_RUE', folder: 'Enjipai', fileFormat:'CSV'})




// Useful Functions

//Function to get the L8 images, apply the cloud mask and calculate the various indices - it finally outputs the median image.
function getL8(geom,date1,date2){
  var col = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                            .map(prepLsSr)
                            .map(addIndices)
                            .filterDate(date1,date2)
  var propertiesImage = col.first()
  var composite = col.qualityMosaic('SAVI')
  return ee.Image(composite);
}

// Define a function that scales and masks Landsat 8 surface reflectance images.
function prepLsSr(image) {
  // Develop masks for unwanted pixels (fill, cloud, cloud shadow).
  var dilated_cloud_bit_mask = (1 << 1 );
  var Cirrus_cloud_bit_mask = (1 << 2);
  var cloud_shadow_bit_mask = (1 << 3);
  var cloud_bit_mask = (1 << 4);
  var qa = image.select('QA_PIXEL');
  var qaMask = (qa.bitwiseAnd(cloud_shadow_bit_mask).eq(0).and(qa.bitwiseAnd(cloud_bit_mask).eq(0)).and(qa.bitwiseAnd(dilated_cloud_bit_mask).eq(0)).and(qa.bitwiseAnd(Cirrus_cloud_bit_mask).eq(0)));
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var getFactorImg = function(factorNames) {
    var factorList = image.toDictionary().select(factorNames).values();
    return ee.Image.constant(factorList);
  };
  var scaleImg = getFactorImg([
    'REFLECTANCE_MULT_BAND_.|TEMPERATURE_MULT_BAND_ST_B10']);
  var offsetImg = getFactorImg([
    'REFLECTANCE_ADD_BAND_.|TEMPERATURE_ADD_BAND_ST_B10']);
  var ndvi = image.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
  var scaled = image.select('SR_B.|ST_B10').multiply(scaleImg).add(offsetImg).addBands([ndvi]);

  // Replace original bands with scaled bands and apply masks.
  return image.addBands(scaled, null, true)
    .updateMask(qaMask).updateMask(saturationMask)
    .copyProperties(image);
}

// Add the Indices as Bands
function addIndices(img){
  var arvi = ARVI(img);
  var atsavi = ATSAVI(img);
  var dvi = DVI(img);
  var evi = EVI(img);
  var evi2 = EVI2(img);
  var gndvi = GNDVI(img);
  var msavi2 = MSAVI2(img);
  var msi = MSI(img);
  var tvi = TVI(img);
  var mtvi = MTVI(img);
  var mtvi2 = MTVI2(img);
  var ndti = NDTI(img);
  var ndvi = NDVI(img);
  var ndwi = NDWI(img);
  var osavi = OSAVI(img);
  var rdvi = RDVI(img);
  var ri = RI(img);
  var rvi = RVI(img);
  var savi = SAVI(img);
  var tsavi = TSAVI2(img);
  var vari = VARI(img);
  var vin = VIN(img);
  var nbr = NBR(img);
  var nbr2 = NBR2(img);
  var mirbi = MIRBI(img);
  var nbi = NBI(img);
return img.addBands([arvi,
                    atsavi,
                    dvi,
                    evi,
                    evi2,
                    gndvi,
                    msavi2,
                    msi,
                    tvi,
                    mtvi,
                    mtvi2,
                    ndti,
                    ndvi,
                    ndwi,
                    osavi,
                    rdvi,
                    ri,
                    rvi,
                    savi,
                    tsavi,
                    vari,
                    vin,
                    nbr,
                    nbr2,
                    mirbi,
                    nbi
                    ]);
}

// ------------- Landsat Indices Functions ------------- 
// Atmospherically Resistant Vegetation Index (ARVI)
function ARVI(img){
  var arvi = img.expression(
    'float(NIR-(R-Y*(B-R)))/(NIR+(R-Y*(B-R)))',{
    NIR : img.select('SR_B5'),
    R : img.select('SR_B4'),
    B: img.select('SR_B2'),
    Y  : ee.Image(1.0),
    });
    arvi = arvi.rename(['ARVI']).float();
    return arvi;
}
// Adjusted transformed soil-adjusted Vegetation Index (ATSAVI)
function ATSAVI(img){
  var atsavi = img.expression(
  '(a*(NIR-a*R-b) / (R+a*NIR-a*b+X*(1+a**2)))',
  {
    R   : img.select('SR_B4'),
    NIR : img.select('SR_B5'),
    a   : ee.Image(1.0),
    b   : ee.Image(0.0),  
    X   : ee.Image(0.08),
  });
  atsavi = atsavi.rename(['ATSAVI']);
  return atsavi;
}
//Difference Vegetation Index (DVI)
function DVI(img){
  var dvi = img.expression(
    '(NIR-RED)',{
    NIR : img.select('SR_B5'),
    RED : img.select('SR_B4'),
    });
    dvi = dvi.rename(['DVI']).float().copyProperties(img, 
      ["system:time_start", "satelite", "sensor", "tile"]);
    return dvi;
}
// Enhanced Vegetation Index (EVI)
function EVI(img){
  var evi = img.expression(
    '2.5*(NIR-RED)/(NIR+C1*RED-C2*BLUE+L)',{
    NIR : img.select('SR_B5'),
    RED : img.select('SR_B4'),
    BLUE: img.select('SR_B2'),
    C1: ee.Image(6.0),
    C2: ee.Image(7.5),
    L : ee.Image(1.0)
    });
    evi = evi.rename(['EVI']).float();
    return evi;
}
function EVI2(img){
  var evi2 = img.expression(
    '2.5*(NIR-RED)/(NIR+C1*RED+1)',{
    NIR : img.select('SR_B5'),
    RED : img.select('SR_B4'),
    C1: ee.Image(2.4),
    });
    evi2 = evi2.rename(['EVI2']).float();
    return evi2;
}
// Green Normalized Difference Vegetation Index (GNDVI)
function GNDVI(img) {
  var gndvi = img.normalizedDifference(['SR_B5', 'SR_B3']);
  gndvi = gndvi.rename(['GNDVI']);
  return gndvi;
}
// Modified Soil Adjusted Vegetation Index (MSAVI2)
function MSAVI2(img){
  var msavi = img.expression(
  '0.5*((2*NIR + 1)-((2*NIR+1)**2-8*(NIR-R))**0.5)',
  {
    R   : img.select('SR_B4'),
    NIR : img.select('SR_B5'),
  });
  msavi =msavi.rename(['MSAVI2']);
  return msavi;
}
//Moisture Stress Index (MSI)
function MSI(img){
  var msi = img.expression(
    '((SWIR1/NIR) > 2.0) ? 2.0 : SWIR1/NIR',
    {
      SWIR1 : img.select('SR_B6'),
      NIR : img.select('SR_B5')
    });
    
    msi = msi.rename(['MSI']).float();
  return msi;
}
//Triangular Vegetation Index
function TVI(img){
  var tvi = img.expression(
  '0.5*(120*(NIR-G)-200*(R-G))',
  {
    G   :img.select('SR_B3'),
    R   :img.select('SR_B4'),
    NIR : img.select('SR_B5'),
  });
  tvi = tvi.rename(['TVI']);
  return tvi;
}
//Modified Triangular Vegetation Index (MTVI)
function MTVI(img){
  var mtvi = img.expression(
    '1.2*(1.2*(NIR-G)-2.5*(R-G))',{
    NIR : img.select('SR_B5'),
    R   : img.select('SR_B4'),
    G   : img.select('SR_B3'),
    });
    mtvi = mtvi.rename(['MTVI']).float();
    return mtvi;
}
//Modified Triangular Vegetation Index 2 (MTVI2)
function MTVI2(img){
  var mtvi2 = img.expression(
    '(1.5*(1.2*(NIR-G)-2.5*(R-G)))/((2*NIR+1)**2-(6*NIR-5*(R)**0.5)-0.5)**0.5',{
    NIR : img.select('SR_B5'),
    R   : img.select('SR_B4'),
    G   : img.select('SR_B3'),
    });
    mtvi2 = mtvi2.rename(['MTVI2']).float();
    return mtvi2;
}
//Normalized Difference Tillage Index (NDTI)
function NDTI(img){
  var ndti = img.normalizedDifference(['SR_B6', 'SR_B7']);
  ndti = ndti.rename(['NDTI']);
  return ndti;
}
//Normalized Difference Vegetation Index (NDVI)
function NDVI(img) {
  var ndvi = img.normalizedDifference(['SR_B5', 'SR_B4']);
  ndvi = ndvi.rename(['NDVI']);
  return ndvi;
}
//Normalized Difference Water Index (NDWI)
function NDWI(img){
  var ndwi = img.normalizedDifference(['SR_B5', 'SR_B6']);
  ndwi = ndwi.rename(['NDWI']);
  return ndwi;
}
//Optimized Soil Adjusted Vegetation Index (OSAVI) x=0.16
function OSAVI(img){
  var osavi = img.expression(
  '((NIR - RED) / (NIR + RED + X))',
  {
    RED : img.select('SR_B4'),
    NIR : img.select('SR_B5'),
    X   : ee.Image(0.16),
  });
  osavi = osavi.rename(['OSAVI']);
  return osavi;
}
//Renormalized Difference Vegetation Index
function RDVI(img){
  var rdvi = img.expression(
  '((NIR - RED) / (NIR + RED )**0.5)',
  {
    RED : img.select('SR_B4'),
    NIR : img.select('SR_B5'),
  });
  rdvi = rdvi.rename(['RDVI']);
  return rdvi;
}
//Redness Index (RI)
function RI(img) {
  var ri = img.normalizedDifference(['SR_B4', 'SR_B3']);
  ri = ri.rename(['RI']);
  return ri;
}
//Ratio Vegetation Index
function RVI(img){
  var rvi = img.expression(
    'R/NIR',
    {
      R : img.select('SR_B4'),
      NIR : img.select('SR_B5')
    });
    
    rvi = rvi.rename(['RVI']).float();
  return rvi;
}
// Soil Adjusted Vegedation Index (SAVI)
function SAVI(img) {
  var savi = img.expression(
  '((1+L) * (NIR - RED) / (L + NIR + RED))',
  {
    RED : img.select('SR_B4'),
    NIR : img.select('SR_B5'),
    L   : ee.Image(0.5),
  });
  savi = savi.rename(['SAVI']);
  return savi;
}
//Transformed Soil Adjusted Vegetation Index 2(TSAVI2)
function TSAVI2(img){
  var tsavi = img.expression(
  '(a*(NIR-a*R-b) / (R+a*NIR-a*b))',
  {
    R   : img.select('SR_B4'),
    NIR : img.select('SR_B5'),
    a   : ee.Image(1.0),
    b   : ee.Image(0.0), 
  });
  tsavi = tsavi.rename(['TSAVI']);
  return tsavi;
}
//Visible Atmospherically Resistant Index (VARI)
function VARI(img){
  var vari = img.expression(
  '( (G - R) / (G + R - B))',
  {
    R : img.select('SR_B4'),
    G : img.select('SR_B3'),
    B : img.select('SR_B2')
  });
  vari = vari.rename(['VARI']);
  return vari;
}
// Visible Atmospherically Resistant Index 2 (VCI)
function VCI(img){
  var vci = img.expression(
  'NDVIma/100*100', //(NDVI-NDVIm)/(NDVIma-NDVIm)*100',
  {
    NDVI :img.select('NDVI'),
    NDVIm : img.select('min'),
    NDVIma : img.select('max') 
  });
  vci = vci.rename(['VCI']);
  return vci;
}
// Vegetation Index Number (VIN)
function VIN(img) {
  var rvi = img.expression(
    'NIR/R',
    {
      R : img.select('SR_B4'),
      NIR : img.select('SR_B5')
    });
    
    rvi = rvi.rename(['VIN']).float();
  return rvi;
}
//Wide Dynamic Range Vegetation Index (WDRVI)
function WDRVI(img){
  var wdrvi = img.expression(
  '((a*NIR - RED) / (a*NIR + RED))',
  {
    RED : 'SR_B4',
    NIR : 'SR_B5',
    a   : ee.Image(0.2), 
  });
  wdrvi = wdrvi.rename(['WDRVI']);
  return wdrvi;
}
//Normalized Burn Ratio (NBR)
function NBR(img){
  var nbr = img.expression({
    expression: '(NIR - SWIR1) / (NIR + SWIR1)',
    map: {
      NIR: img.select('SR_B5'),
      SWIR1: img.select('SR_B6')
    }
  });
  return nbr.rename("NBR");
}
//Normalized Burn Ratio 2 (NBR2)
function NBR2(img){
  var nbr2 = img.expression({
    expression: '(SWIR1 - SWIR2) / (SWIR1 + SWIR2)',
    map: {
      SWIR1: img.select('SR_B6'),
      SWIR2: img.select('SR_B7')
    }
  });
  return nbr2.rename('NBR2');
}
//Mid Infra-red Burn Index (MIRBI)
function MIRBI(img){
  var mirbi = img.expression({
    expression: '(SWIR2 * 10) - (SWIR1 * 9.8) + 2',
    map: {
      SWIR1: img.select('SR_B6'),
      SWIR2: img.select('SR_B7')
    }
  });
  var valid = mirbi.gte(-15000)
  return mirbi.updateMask(valid)
    .rename('MIRBI');
}
//Normalized Burn Index (NBI)
function NBI(img){
  var nbi = img.expression({
    expression: '(SWIR2 - BLUE) / (SWIR1 + BLUE)',
    map: {
      BLUE: img.select('SR_B2'),
      SWIR1: img.select('SR_B6'),
      SWIR2: img.select('SR_B7')
    }
  });
  return nbi.rename("NBI");
}
