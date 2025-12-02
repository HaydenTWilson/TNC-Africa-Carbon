/* Welcome to the TNC VM0048 Risk Mapping tool - Developed by Dr Hayden Wilson - Hayden.wilson@tnc.org
Release date  - 02 Dec 2025
License - Creative Commons CC BY-SA.

This script is developed with the aim of assisting projects develop an ex-ante estimation of the likely future rates of deforestation within their projects jurisdiction.
it does not serve as a replacement to the official risk maps published by verra, but rather as a stand in - interim version which can be used in conjunction with other tools 
in this repository to estimate the likely baseline rates of deforestation a project will experience during the Baseline validity period.

The tool has been developed to be used in conjunction with the Clarklab Udef-ARP tool, available at https://github.com/ClarkCGA/UDef-ARP.
The tool utilises a random forest in regression mode to produce a deforestation probability value between 0 and 1. 
The tool is trained on multiple historical temporal periods, with deforestation activity from the subsequent temporal period used as labels.

Inputs for the algorithm include:
  1. Distance from Forest Edge
  2. Distance from historical Deforestation
  3. Landscape Access (distance from roads, rivers, population centers)
  4. Distance from Crops
  5. Distance from Populated Areas
  6. Slope
  7. Elevation
  8. Aboveground woody Biomass.

The tool performs accuracy assessments of the models performance on both training and validation samples.
The tool also outputs the requisite data to perform a full model assessement and deforestation risk allocation in the Clarklbas UDef-ARP tool.
Outputs include:
  1. A map of the administrative divisions of the jurisdiction.
  2. A binary map of the jurisdiction.
  3. Forest Extent in the CAL, CNF and Baseline Validity Periods
  4. Distance from Forest Edge in the CAL, CNF and Baseline Validity Periods
  5. Deforestation in the CAL, CNF and Baseline Validity Periods
  6. Deforestation Risk maps for the CAL, CNF and Baseline Validity Periods

The algorithm has been configured to take a single input - a point in the jurisdiction that will be modelled.
*/

//////////////////////////////// ------------------- Script Begins ------------------- ////////////////////////////////

var point = /* color: #ffc82d */ee.Geometry.Point([32.48407031463026, 2.282253565280786]);

//increase number of samples until the computation times out.
var samples = 600

var drive_folder = 'UGA'

var jurisdiction = ee.FeatureCollection("FAO/GAUL/2015/level0").filterBounds(point)

var ADM0_CODE = jurisdiction.first().get('ADM0_CODE')
var jurisdiction_bounds = ee.FeatureCollection("FAO/GAUL/2015/level0").filterBounds(point).bounds()
var admin = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level1").filter(ee.Filter.eq('ADM0_CODE', ADM0_CODE))

Map.addLayer(jurisdiction,{},'jurisdiction')
Map.addLayer(admin,{},'Admin')

Map.centerObject(point, 12)


var adminImg = admin.reduceToImage({
    properties: ['ADM1_CODE'],
    reducer: ee.Reducer.first()
});

var jurisdictionImg = ee.Image(0).where(jurisdiction.reduceToImage({
    properties: ['ADM0_CODE'],
    reducer: ee.Reducer.first()
}).gt(0), 1).clip(jurisdiction_bounds).rename('jurisdiction');

var adminList = admin.aggregate_array('ADM1_CODE')
var reclassList = ee.List.sequence(1,adminList.length(),1)

var adminImg2 = adminImg.remap(adminList,reclassList)
var adminImg3 = ee.Image(0).where(adminImg2.gt(0),adminImg2).clip(jurisdiction_bounds).rename('admin')

var Dist_vis = {min: 0, max: 10000};

function Dist(img,targetval){
  var fastDistTrans = img.eq(targetval).fastDistanceTransform(500).sqrt().multiply(ee.Image.pixelArea().sqrt()).reproject({crs:crs, scale:scale})
  return fastDistTrans
}

////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////

//Calibrate the input layers
var hansen = ee.Image("UMD/hansen/global_forest_change_2024_v1_12")
var lossyear = hansen.select('lossyear')
var forest_mask = ee.Image(0).where(hansen.select('treecover2000').gte(15),1)

//////// Gather some Data
var proj = hansen.projection();
var crs = proj.crs();
var scale = proj.nominalScale();

//Harmonised Landcover change
// Yearly data from 2000-2022
var annual = ee.ImageCollection('projects/sat-io/open-datasets/GLC-FCS30D/annual')

// Five-Yearly data for 1985-90, 1990-95 and 1995-2000
var fiveyear = ee.ImageCollection('projects/sat-io/open-datasets/GLC-FCS30D/five-years-map')

// Classification scheme has 36 classes (35 landcover classes and 1 fill value)
var classValues = [10, 11, 12, 20, 51, 52, 61, 62, 71, 72, 81, 82, 91, 92, 120, 121, 122, 130, 140, 150, 152, 153, 181, 182, 183, 184, 185, 186, 187, 190, 200, 201, 202, 210, 220, 0];
var classNames = ['Rainfed_cropland', //1
                  'Herbaceous_cover_cropland', //2
                  'Tree_or_shrub_cover_cropland', //3
                  'Irrigated_cropland', //4
                  'Open_evergreen_broadleaved_forest', //5
                  'Closed_evergreen_broadleaved_forest', //6
                  'Open_deciduous_broadleaved_forest', //7
                  'Closed_deciduous_broadleaved_forest', //8
                  'Open_evergreen_needle_leaved_forest', //9
                  'Closed_evergreen_needle_leaved_forest', //10
                  'Open_deciduous_needle_leaved_forest', //11
                  'Closed_deciduous_needle_leaved_forest', //12
                  'Open_mixed_leaf_forest', //13
                  'Closed_mixed_leaf_forest', //14
                  'Shrubland', //15
                  'Evergreen_shrubland', //16
                  'Deciduous_shrubland', //17
                  'Grassland', //18
                  'Lichens_and_mosses', //19
                  'Sparse_vegetation', //20
                  'Sparse_shrubland', //21
                  'Sparse_herbaceous', //22
                  'Swamp', 'Marsh', //23
                  'Flooded_flat', //24
                  'Saline', //25
                  'Mangrove', //26
                  'Salt_marsh', //27
                  'Tidal_flat', //28
                  'Impervious_surfaces', //29
                  'Bare_areas', //30
                  'Consolidated_bare_areas', //31
                  'Unconsolidated_bare_areas', //32
                  'Water_body', //33
                  'Permanent_ice_and_snow', //34
                  'Filled_value']; //35
                  
var classColors = ['#ffff64', '#ffff64', '#ffff00', '#aaf0f0', '#4c7300', '#006400', '#a8c800', '#00a000', '#005000', '#003c00', '#286400', '#285000', '#a0b432', '#788200', '#966400', '#964b00', '#966400', '#ffb432', '#ffdcd2', '#ffebaf', '#ffd278', '#ffebaf', '#00a884', '#73ffdf', '#9ebb3b', '#828282', '#f57ab6', '#66cdab', '#444f89', '#c31400', '#fff5d7', '#dcdcdc', '#fff5d7', '#0046c8', '#ffffff', '#ffffff'];

// Mosaic the data into a single image
var annualMosaic = annual.mosaic()
var fiveYearMosaic = fiveyear.mosaic()

// Rename bands from b1, b2, etc. to 2000, 2001, etc.
var fiveYearsList = ee.List.sequence(1985, 1995, 5).map(function(year) { return ee.Number(year).format('%04d'); });
var fiveyearMosaicRenamed = fiveYearMosaic.rename(fiveYearsList);
var yearsList = ee.List.sequence(2000, 2022).map(function(year) { return ee.Number(year).format('%04d'); });
var annualMosaicRenamed = annualMosaic.rename(yearsList);
var years = fiveYearsList.cat(yearsList);

// Convert the multiband image to an ImageCollection
var fiveYearlyMosaics = fiveYearsList.map(function(year) {
  var date = ee.Date.fromYMD(ee.Number.parse(year), 1, 1);
  return fiveyearMosaicRenamed.select([year]).set({'system:time_start': date.millis(), 'system:index': year, 'year': ee.Number.parse(year)});
});
var yearlyMosaics = yearsList.map(function(year) {
  var date = ee.Date.fromYMD(ee.Number.parse(year), 1, 1);
  return annualMosaicRenamed.select([year]).set({'system:time_start': date.millis(), 'system:index': year, 'year': ee.Number.parse(year)});
});
var allMosaics = fiveYearlyMosaics.cat(yearlyMosaics);
var mosaicsCol = ee.ImageCollection.fromImages(allMosaics);

// Recode the class values into sequential values
var newClassValues = ee.List.sequence(1, ee.List(classValues).length());
var renameClasses = function(image) {
  var reclassified = image.remap(classValues, newClassValues).rename('classification');
  return reclassified;
};
var landcoverCol = mosaicsCol.map(renameClasses);

//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////

// Time periods investigated include are as follows: 
// 2000 - 2010, 2010 - 2015, 2015 -2020, 2020 - 2024

// for each assessed time period the following data is used
// 1. Distance from forest edge at the begining of the period
// 2. Distance from accumulated deforestation in the previous period
// 3. Distance from Cropland
// 4. Access to cities
// 5. Aboveground woody Biomass


// Labels = deforestation that occured during the time period.

function GatherData(start,end){
  var forest_mask2 = forest_mask.where((landcoverCol.filter(ee.Filter.eq('year', 2000 + start)).first()).lte(4),0)
  var defor = ee.Image(0).where(lossyear.gte(1).and(lossyear.lte(start)),1).rename('defor')
  var defor_dist = Dist(defor,1).rename('defor_dist')
  var forest_start = forest_mask2.where(lossyear.gte(1).and(lossyear.lte(start)),0).rename('forest')
  var forest_edge_dist = Dist(forest_start,0).rename('forest_edge_dist')
  var cropland_start = ee.Image(0).where(landcoverCol.filter(ee.Filter.eq('year', 2000 + start)).first().lte(4),1).rename('cropland');
  var crop_dist = Dist(cropland_start,1).rename('cropland_dist')
  var access = ee.Image("Oxford/MAP/accessibility_to_cities_2015_v1_0")
  var SRTM = ee.Image("USGS/SRTMGL1_003")
  var slope = ee.Terrain.slope(SRTM)
  var agb = ee.ImageCollection("projects/sat-io/open-datasets/ESA/ESA_CCI_AGB").filter(ee.Filter.date(ee.String(ee.Number(2000+start)).cat(ee.String('-01-01')), ee.String(ee.Number(2000+end)).cat(ee.String('-12-31')))).first().select('AGB')
  var worldPop = ee.Image(0).where(ee.ImageCollection('projects/sat-io/open-datasets/WORLDPOP/pop').filter(ee.Filter.date(ee.String(ee.Number(2000+end)).cat(ee.String('-01-01')), ee.String(ee.Number(2000+end)).cat(ee.String('-12-31')))).mosaic().gte(1),1).rename('pop_centers')
  var pop_dist = Dist(worldPop,1).rename('pop_dist')
  return forest_start.addBands([defor_dist,forest_edge_dist,crop_dist,access,SRTM,slope,agb,pop_dist])
}

var historical = GatherData(10,15)

var historical_sample = historical.addBands(ee.Image(0).where(lossyear.gte(16).and(lossyear.lte(18)),1).rename('labels')).mask(historical.select('forest').eq(1)).stratifiedSample({
  numPoints: samples,
  classBand: 'labels',
  region: jurisdiction,
  scale: scale,
  geometries: true
});


var T1 = GatherData(16,18)
var T1_sample =T1.addBands(ee.Image(0).where(lossyear.gte(19).and(lossyear.lte(21)),1).rename('labels')).mask(T1.select('forest').eq(1)).stratifiedSample({
  numPoints: samples,
  classBand: 'labels',
  region: jurisdiction,
  scale: scale,
  geometries: true
});


var sample = historical_sample.merge(T1_sample)

sample = sample.randomColumn();
var trainingSample = sample.filter('random <= 0.8');
var testSample = sample.filter('random > 0.8');

var trainedClassifier = ee.Classifier.smileRandomForest(200)
    .train({
      features: trainingSample,
      classProperty: 'labels',
      inputProperties: ['defor_dist','forest_edge_dist','cropland_dist','accessibility','slope','AGB','pop_dist']});
print('Results of trained classifier', trainedClassifier.explain());

// Get a confusion matrix and overall accuracy for the training sample.
var trainAccuracy = trainedClassifier.confusionMatrix();
print('Training error matrix', trainAccuracy);
print('Training overall accuracy', trainAccuracy.accuracy());

testSample = testSample.classify(trainedClassifier);
print('testSample:',testSample)

var testAccuracy = testSample.errorMatrix('labels', 'classification');
print('Test error matrix', testAccuracy);
print('Test accuracy', testAccuracy.accuracy());


var T2 = GatherData(19,21)
var Validation_sample = T2.addBands(ee.Image(0).where(lossyear.gte(22).and(lossyear.lte(25)),1).rename('labels')).mask(T2.select('forest').eq(1)).stratifiedSample({
  numPoints: 1200,
  classBand: 'labels',
  region: jurisdiction,
  scale: scale,
  geometries: true
});

Validation_sample = Validation_sample.classify(trainedClassifier);
var ValidationAccuracy = Validation_sample.errorMatrix('labels', 'classification');
print('Validation error matrix', ValidationAccuracy);
print('Validation accuracy', ValidationAccuracy.accuracy());

////// Convert the classifier to probability mode
var trainedClassifier = ee.Classifier.smileRandomForest(200).setOutputMode('PROBABILITY')
    .train({
      features: trainingSample,
      classProperty: 'labels',
      inputProperties: ['defor_dist','forest_edge_dist','cropland_dist','accessibility','slope','AGB','pop_dist']});

var CAL = GatherData(15,18)
var CAL_forest = CAL.select('forest').eq(1)
var CAL_forest_dist = CAL.select('forest_edge_dist').rename('forest_dist')
var CAL_Defor = ee.Image(0).where(forest_mask.eq(1).and(lossyear.gte(15)).and(lossyear.lte(18)),1).rename('defor')
var CAL_probability = ee.Image(0).where(CAL.select('forest').eq(1),CAL.select(['defor_dist','forest_edge_dist','cropland_dist','accessibility','slope','AGB','pop_dist']).classify(trainedClassifier)).rename("classification");
var CNF = GatherData(19,22)
var CNF_forest = CNF.select('forest').eq(1)
var CNF_forest_dist = CNF.select('forest_edge_dist').rename('forest_dist')
var CNF_Defor = ee.Image(0).where(forest_mask.eq(1).and(lossyear.gte(19)).and(lossyear.lte(22)),1).rename('defor')
var CNF_probability = ee.Image(0).where(CNF.select('forest').eq(1),CNF.select(['defor_dist','forest_edge_dist','cropland_dist','accessibility','slope','AGB','pop_dist']).classify(trainedClassifier)).rename("classification");
var BVP = GatherData(22,25)
var BVP_forest = BVP.select('forest').eq(1)
var BVP_forest_dist = BVP.select('forest_edge_dist').rename('forest_dist')
var BVP_Defor = ee.Image(0).where(forest_mask.eq(1).and(lossyear.gte(22)).and(lossyear.lte(25)),1).rename('defor') 
var BVP_probability = ee.Image(0).where(BVP.select('forest').eq(1),BVP.select(['defor_dist','forest_edge_dist','cropland_dist','accessibility','slope','AGB','pop_dist']).classify(trainedClassifier)).rename("classification");

var HRP_Defor = ee.Image(0).where(forest_mask.eq(1).and(lossyear.gte(15)).and(lossyear.lte(25)),1).rename('defor')

Map.addLayer(BVP.select('forest').clip(jurisdiction),{min:0,max:1,palette:['black','green']},'forest - BVP')
Map.addLayer(BVP_probability,{'bands': ["classification"], 'palette': ['black','blue', 'green', 'yellow', 'orange', 'red'],'max': 1}, 'probability')


// ////////////////////////////////////////////////////////////////////////////////////////////////
// ////////////////////////////////////////////////////////////////////////////////////////////////
// ////////////////////////////////////////////////////////////////////////////////////////////////
// ////////////////////////////////////////////////////////////////////////////////////////////////
// ////////////////////////////////////////////////////////////////////////////////////////////////

// Export the data
Export.image.toDrive({
  image: CAL_forest.toInt8(),
  description: 'CAL_Forest',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: CNF_forest.toInt8(),
  description: 'CNF_Forest',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: BVP_forest.toInt8(),
  description: 'BVP_Forest',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: CAL_Defor.toInt8(),
  description: 'CAL_Defor',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: CNF_Defor.toInt8(),
  description: 'CNF_Defor',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: HRP_Defor.toInt8(),
  description: 'HRP_Defor',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: BVP_Defor.toInt8(),
  description: 'BVP_Defor',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: CAL_forest_dist.toFloat(),
  description: 'CAL_Dist',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: CNF_forest_dist.toFloat(),
  description: 'CNF_forest',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: BVP_forest_dist.toFloat(),
  description: 'BVP_Dist',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: CAL_probability.toFloat(),
  description: 'CAL_Riskmap',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: CNF_probability.toFloat(),
  description: 'CNF_Riskmap',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: BVP_probability.toFloat(),
  description: 'BVP_Riskmap',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: adminImg.toInt8(),
  description: 'Admin',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});

Export.image.toDrive({
  image: jurisdictionImg.toInt8(),
  description: 'Jurisdiction',
  folder: drive_folder, //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: jurisdiction_bounds
});
