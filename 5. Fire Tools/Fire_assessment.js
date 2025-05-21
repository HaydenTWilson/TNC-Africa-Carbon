/* Welcome to the TNC fire analysis script - Developed by Dr Hayden Wilson - Hayden.wilson@tnc.org and Dr Nathaniel Robinson - nathanielpaulrobinson@gmail.com
License - Creative Commons CC BY-SA.
This script performs a temporal assessment of burned area and uses Sentinel 2.
It estimates the day of the year (DOY) that the burn scar appeared for each year specified 
and then from there calculates the time since present day that the fire occured, 
the frequency of fires in the early dry season and late dry season,
and estimates the total hectares burned in the early vs late dry season for each year and presents these findings as a graph.
the threshold for Early vs late Dry season is defined using a cutoff of end july in this example'
*/

var eoi = 
    ee.Geometry.Polygon(
        [[[25.626737231285475, -15.026475986048068],
          [25.626737231285475, -15.322042064915752],
          [25.9631935301136, -15.322042064915752],
          [25.9631935301136, -15.026475986048068]]], null, false); // the area of interest for the analysis
          
Map.centerObject(eoi,8)

// ------------- Parameters for Cloud Masking ------------- 
var csPlus = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED");
var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED");
var CLEAR_THRESHOLD = 0.70;
var QA_BAND = 'cs_cdf';

// ------------- Create the Burn scar maps for each year, estimating the day of the year the fire occured.  ------------- 
var burn_2019 = FireDate('2019-01-01', '2019-12-31',eoi).clip(eoi)
var burn_2020 = FireDate('2020-01-01', '2020-12-31',eoi).clip(eoi)
var burn_2021 = FireDate('2021-01-01', '2021-12-31',eoi).clip(eoi)
var burn_2022 = FireDate('2022-01-01', '2022-12-31',eoi).clip(eoi)
var burn_2023 = FireDate('2023-01-01', '2023-12-31',eoi).clip(eoi)
var burn_2024 = FireDate('2024-01-01', '2024-11-20',eoi).clip(eoi)

//  ------------- Combine each year into an imageCollection ------------- 
var BurnDate_col = ee.ImageCollection([burn_2019,burn_2020,burn_2021,burn_2022,burn_2023,burn_2024])

//  ------------- Combine each year into an image for export ------------- 
var burn_2019_Day = burn_2019.select('Burn_DOY').rename('2019')
var burn_2020_Day = burn_2020.select('Burn_DOY').rename('2020')
var burn_2021_Day = burn_2021.select('Burn_DOY').rename('2021')
var burn_2022_Day = burn_2022.select('Burn_DOY').rename('2022')
var burn_2023_Day = burn_2023.select('Burn_DOY').rename('2023')
var burn_2024_Day = burn_2024.select('Burn_DOY').rename('2024')

var Area = ee.Image.pixelArea().reproject({crs: 'EPSG:32735',scale: 30})
var EDS_Area_masked_2024 = (Area.updateMask(burn_2024_Day.select('2024').lt(214)))
var LDS_Area_masked_2024 = (Area.updateMask(burn_2024_Day.select('2024').gte(214)))
var tot_2024 = (Area.updateMask(burn_2024_Day.select('2024').gte(1)))

var EDS_area_2024 = EDS_Area_masked_2024.reduceRegion({reducer:ee.Reducer.sum(), geometry: eoi, maxPixels: 1e13,scale:50, bestEffort:true, tileScale:16})
print('EDS_Area_M2', EDS_area_2024)
var LDS_area_2024 = LDS_Area_masked_2024.reduceRegion({reducer:ee.Reducer.sum(), geometry: eoi, maxPixels: 1e13,scale:50, bestEffort:true, tileScale:16})
print('LDS_Area_M2', LDS_area_2024)
var tot_area_2024 = tot_2024.reduceRegion({reducer:ee.Reducer.sum(), geometry: eoi, maxPixels: 1e13,scale:50, bestEffort:true, tileScale:16})
print('Tot_Area_M2', tot_area_2024)

var export_image = burn_2019_Day.addBands([burn_2020_Day,burn_2021_Day,burn_2022_Day,burn_2023_Day,burn_2024_Day])

// ------------- Calculate the number of years ago (since present day) that the fire occured------------- 
// ------------- in this case, day 214 is used as the cutoff between late vs early season fires.
var yearsSinceFire = ee.Image(ee.Date(Date.now()).get('year')).subtract(BurnDate_col.select('Burn_Year').max())

//--- Southern Hemisphere version ----------
var EDS = BurnDate_col.select('Burn_DOY').map(function(img){return img.lt(214)}).sum()
var LDS = BurnDate_col.select('Burn_DOY').map(function(img){return img.gte(214)}).sum()

// // --- Northern Hemisphere version ----------
// var EDS = BurnDate_col.select('Burn_DOY').map(function(img){return img.gte(121).and(img.lt(32))}).sum()
// var LDS = BurnDate_col.select('Burn_DOY').map(function(img){return img.gte(32).and(img.lt(121))}).sum()




// // ------------- Create a Chart of the number of fires that occured in each season.
var TS = BurnDate_col.map(function(img){
                            var year = img.select('Burn_Year')
                            var Area = ee.Image.pixelArea().reproject({crs: 'EPSG:32735',scale: 30})
                            var EDS_Area_mask = (Area.updateMask(img.select('Burn_DOY').lt(214)))
                            var LDS_Area_mask = (Area.updateMask(img.select('Burn_DOY').gte(214)))
                            var Tot_Area_mask = (Area.updateMask(img.select('Burn_DOY').gt(1)))
                            var EDS_Area_prop = EDS_Area_mask.reduceRegion({reducer:ee.Reducer.sum(), geometry: eoi, maxPixels: 1e13,scale:50, bestEffort:true, tileScale:16})
                            var LDS_Area_prop = LDS_Area_mask.reduceRegion({reducer:ee.Reducer.sum(), geometry: eoi, maxPixels: 1e13,scale:50, bestEffort:true, tileScale:16})
                            var Tot_Area_prop = Tot_Area_mask.reduceRegion({reducer:ee.Reducer.sum(), geometry: eoi, maxPixels: 1e13,scale:50, bestEffort:true, tileScale:16})
                            var year_prop = year.reduceRegion({reducer:ee.Reducer.mode(), geometry: eoi, maxPixels: 1e13,scale:500, bestEffort:true, tileScale:16})
                            return img.set('year', year_prop).set('EDS_Area', EDS_Area_prop).set('LDS_Area', LDS_Area_prop).set('Tot_Area', Tot_Area_prop)
})

var xValues = ee.List(TS.aggregate_array('year').map(function(dict){return ee.Number(ee.Dictionary(dict).get('Burn_Year'))}))
var TotareaList = ee.List(TS.aggregate_array('Tot_Area').map(function(dict){return ee.Number(ee.Dictionary(dict).get('area')).divide(10000)}))
var EDSareaList = ee.List(TS.aggregate_array('EDS_Area').map(function(dict){return ee.Number(ee.Dictionary(dict).get('area')).divide(10000)}))
var LDSareaList = ee.List(TS.aggregate_array('LDS_Area').map(function(dict){return ee.Number(ee.Dictionary(dict).get('area')).divide(10000)}))

var yValues = ee.List([EDSareaList, LDSareaList, TotareaList]);


// Define the chart and print it to the console.
var chart = ui.Chart.array.values({array: yValues, axis: 1, xLabels: xValues})
                .setSeriesNames(['EDS', 'LDS'])
                .setOptions({
                  title: 'Burned Area per year',
                  hAxis: {
                    title: 'Year',
                    titleTextStyle: {italic: false, bold: true}
                  },
                  vAxis: {
                    title: 'Area (m2)',
                    titleTextStyle: {italic: false, bold: true}
                  },
                  colors: ['green','red', 'blue'],
                  lineSize: 1,
                  pointSize: 0,
                });
print(chart);


// ------------- Visualise the Outputs ------------- 
Map.addLayer(burn_2024.select('Burn_DOY').randomVisualizer(), {}, 'Day of burn - 2024')
Map.addLayer(yearsSinceFire, {min:0, max:6, palette:['red','orange', 'yellow', 'green', 'blue']}, 'years since fire')
Map.addLayer(EDS, {min:0, max:6, palette:['green','yellow','orange','red']}, 'EDS Fire Frequency');
Map.addLayer(LDS, {min:0, max:6, palette:['green','yellow','orange','red']}, 'LDS Fire Frequency');

// ------------- Export the Burn Scars to Google Drive as an image, where each band is one of the years burn scars ------------- 
Export.image.toDrive({
  image:export_image, 
  description:'Yearly_Burn_scars_29_11_2024', 
  scale: 30,
  region:eoi, 
  maxPixels:1e13, 
});

// ------------- Functions ----------------
function addYear(img){
  var year = img.date().get('year')
  var yearImage = ee.Image(year).rename('year')
  return img.addBands([yearImage]).toInt()
}
function maskClouds(img){
  return img.updateMask(img.select(QA_BAND).gte(CLEAR_THRESHOLD));
}
function addDoyBand(img){
  var doy = ee.Image(
    img.date()
    .getRelative('day', 'year')
    )
    .int()
    .rename('DOY');
  var invDoy = doy.multiply(-1).rename('DOY_INV')
  return img.addBands([doy, invDoy]);
}
function nbrCalc(img){
  var nbr = img.expression({
    expression: '(NIR - SWIR1) / (NIR + SWIR1)',
    map: {
      NIR: img.select('B8'),
      SWIR1: img.select('B11')
    }
  });
  return nbr.rename("NBR");
}
function nbr2Calc(img){
  var nbr2 = img.expression({
    expression: '(SWIR1 - SWIR2) / (SWIR1 + SWIR2)',
    map: {
      SWIR1: img.select('B11'),
      SWIR2: img.select('B12')
    }
  });
  return nbr2.rename('NBR2');
}
function mirbiCalc(img){
  var mirbi = img.expression({
    expression: '(SWIR2 * 10) - (SWIR1 * 9.8) + 2',
    map: {
      SWIR1: img.select('B11'),
      SWIR2: img.select('B12')
    }
  });
  var valid = mirbi.gte(-15000)
  return mirbi.updateMask(valid)
    .rename('MIRBI');
}
function nbiCalc(img){
  var nbi = img.expression({
    expression: '(SWIR2 - BLUE) / (SWIR1 + BLUE)',
    map: {
      BLUE: img.select('B2'),
      SWIR1: img.select('B11'),
      SWIR2: img.select('B12')
    }
  });
  return nbi.rename("NBI");
}
function ndviCalc(img){
  var ndvi = img.expression({
    expression: '(NIR - RED) / (NIR + RED)',
    map: {
      NIR: img.select('B8'),
      RED: img.select('B4')
    }
  });
  return ndvi.rename("NDVI");
}
function gndviCalc(img){
  var gndvi = img.expression({
    expression: '(NIR - GREEN) / (NIR + GREEN)',
    map: {
      NIR: img.select('B8'),
      GREEN: img.select('B3')
    }
  });
  return gndvi.rename("GNDVI");
}
function addIndices(img){
  var nbr = nbrCalc(img);
  var nbr2 = nbr2Calc(img);
  var mirbi = mirbiCalc(img);
  var nbi = nbiCalc(img);
  var ndvi = ndviCalc(img);
  var gndvi = gndviCalc(img);
  return img.addBands([
    nbr, nbr2, mirbi, nbi, ndvi, gndvi
    ]);
}
function createDatesList(start, end, interval) {
  var date1 = new Date(start).getTime();
  var date2 = new Date(end).getTime();
  
  var int = interval * 24 * 60 * 60 * 1000;
  var dates = [];
  
  for (var i = date1; i<= date2; i+=int){
    var date = new Date(i);
    dates.push(date);
  }
  return dates;
}
function FireDate(start_date, end_date,geom){
  var maxWindow = 30;
  var backBuffer = maxWindow / 2 * -1;
  var forwardBuffer = maxWindow / 2; 
  var dailyInterval = 3;
  var minPatchSize = 1;
  var start = ee.Date(start_date).advance(backBuffer, 'day');
  var end = ee.Date(end_date).advance(forwardBuffer, 'day');
  var dates = createDatesList(start_date, end_date, dailyInterval);
  var s2Processed = s2
    .filterBounds(eoi)
    .filterDate(start, end)
    .linkCollection(csPlus, [QA_BAND])
    .map(addDoyBand)
    .map(maskClouds)
    .map(addIndices)
    .map(function(i){return i.clip(geom)});
  var ts = ee.ImageCollection(dates.map(function(date){
    var date1 = ee.Date(date).advance(backBuffer, 'day');
    var date2 = ee.Date(date).advance(forwardBuffer, 'day');
    var col1 = s2Processed.filterDate(date1, date).qualityMosaic('DOY');
    var col2 = s2Processed.filterDate(date, date2).qualityMosaic('DOY_INV');
    var diff1 = col1.select('NBR2').subtract(col2.select('NBR2'));
    var diff2 = col2.select('MIRBI').subtract(col1.select('MIRBI'));
    var combined = diff2.gte(4000);
    var doy1 = col1.select('DOY');
    var doy2 = col2.select('DOY');
    var doy = ee.Image(ee.Date(date).getRelative('day', 'year')).int().rename('Burn_DOY');
    var year = ee.Image(ee.Date(date).get('year')).int().rename('Burn_Year');
    return (doy.addBands([year])).updateMask(combined);}));
  var earliestBurnDate = ts.min();
  // var minPatchSizePixels = minPatchSize * 100 ;
  // var patchMask = earliestBurnDate.connectedPixelCount(minPatchSizePixels, true).gte(minPatchSizePixels);
  // earliestBurnDate=earliestBurnDate.updateMask(patchMask).reproject("EPSG:4326", null, 10);
  return earliestBurnDate.toInt()
}