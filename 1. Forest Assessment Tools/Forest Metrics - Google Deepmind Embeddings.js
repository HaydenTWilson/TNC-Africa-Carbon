/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var AOI = ee.FeatureCollection("projects/ee-theonlyhayden/assets/Kafue_Fire_Project_EOI_Final");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
// Define analysis Scale and projection paramaters

var gridScale = 50;
var gridProjection = ee.Projection('EPSG:3857')
  .atScale(gridScale);


// Define the years to gather training data
var yearList = ee.List.sequence(2019,2025,1)


// Step 1  ---  Gather Training Data
var split = 0.8; // split ratio between training and validation samples
var numSamples = 2000; // number of samples to collect per year



//--------------------------------------------- AGBD Training Data ---------------------------------------------
var agbd_samples = ee.FeatureCollection(yearList.map(AGBD_timeEmbeddings)).flatten().randomColumn('random', 27);
var agbd_trainingData = agbd_samples.filter(ee.Filter.lt('random', split));
var agbd_validationData = agbd_samples.filter(ee.Filter.gte('random', split));

Export.table.toAsset({collection:agbd_trainingData, 
                      description:'AGBD_Training_Data_Export', 
                      assetId: 'projects/ee-theonlyhayden/assets/Satellite_Embedding/agbd_trainingData', 
                      overwrite:true})

Export.table.toAsset({collection:agbd_validationData, 
                      description:'AGBD_Validation_Data_Export', 
                      assetId: 'projects/ee-theonlyhayden/assets/Satellite_Embedding/agbd_validationData', 
                      overwrite:true})

//--------------------------------------------- CC Training Data ---------------------------------------------
var cc_samples = ee.FeatureCollection(yearList.map(CC_timeEmbeddings)).flatten().randomColumn('random', 27);

var cc_trainingData = cc_samples.filter(ee.Filter.lt('random', split));
var cc_validationData = cc_samples.filter(ee.Filter.gte('random', split));

Export.table.toAsset({collection:cc_trainingData, 
                      description:'CC_Training_Data_Export', 
                      assetId: 'projects/ee-theonlyhayden/assets/Satellite_Embedding/cc_trainingData', 
                      overwrite:true})

Export.table.toAsset({collection:cc_validationData, 
                      description:'CC_Validation_Data_Export', 
                      assetId: 'projects/ee-theonlyhayden/assets/Satellite_Embedding/cc_validationData', 
                      overwrite:true})

//--------------------------------------------- Height Training Data ---------------------------------------------
var height_samples = ee.FeatureCollection(yearList.map(height_timeEmbeddings)).flatten().randomColumn('random', 27);

var height_trainingData = height_samples.filter(ee.Filter.lt('random', split));
var height_validationData = height_samples.filter(ee.Filter.gte('random', split));

Export.table.toAsset({collection:height_trainingData, 
                      description:'Height_Training_Data_Export', 
                      assetId: 'projects/ee-theonlyhayden/assets/Satellite_Embedding/height_trainingData', 
                      overwrite:true})

Export.table.toAsset({collection:height_validationData, 
                      description:'Height_Validation_Data_Export', 
                      assetId: 'projects/ee-theonlyhayden/assets/Satellite_Embedding/height_validationData', 
                      overwrite:true})


// Step 2 --- Train and Test Models


//--------------------------------------------- AGBD Model ---------------------------------------------
print('------------- Training AGB Model -------------')
var agbd_training_featureCollection = ee.FeatureCollection('projects/ee-theonlyhayden/assets/Satellite_Embedding/agbd_trainingData')
var agbd_validation_featureCollection = ee.FeatureCollection('projects/ee-theonlyhayden/assets/Satellite_Embedding/agbd_validationData')

var agbd_predictors  = agbd_training_featureCollection.first().propertyNames().filter(ee.Filter.neq('item','agbd'))
                                                                    .filter(ee.Filter.neq('item','random'))
                                                                    .filter(ee.Filter.neq('item','class'))
                                                                    .filter(ee.Filter.neq('item','system:index'))

var agbd_model = ee.Classifier.smileRandomForest(300)
  .setOutputMode('REGRESSION')
  .train({
    features: agbd_training_featureCollection,
    classProperty: 'agbd',
    inputProperties: agbd_predictors
  });

// Get model's predictions for training samples
var agbd_training_predicted = agbd_training_featureCollection.classify({
  classifier: agbd_model,
  outputName: 'agbd_predicted'
});
var training_rmse = calculateRmse('agbd',agbd_training_predicted);
print('RMSE', training_rmse);

var chartTraining = ui.Chart.feature.byFeature(agbd_training_predicted.limit(5000), 'agbd', 'agbd_predicted').setChartType('ScatterChart').setOptions({
    title: 'AGBD - Predicted vs Observed - Training data ',
    hAxis: {'title': 'observed'},
    vAxis: {'title': 'predicted'},
    pointSize: 3,
    trendlines: { 0: {showR2: true, visibleInLegend: true} ,1: {showR2: true, visibleInLegend: true}}});
print(chartTraining);


var agbd_validation_predicted = agbd_validation_featureCollection.classify({
  classifier: agbd_model,
  outputName: 'agbd_predicted'
});
var agbd_validation_rmse = calculateRmse('agbd',agbd_validation_predicted);
print('RMSE', agbd_validation_rmse);

var chartValidation = ui.Chart.feature.byFeature(agbd_validation_predicted, 'agbd', 'agbd_predicted').setChartType('ScatterChart').setOptions({
    title: 'AGBD - Predicted vs Observed - Validation data ',
    hAxis: {'title': 'observed'},
    vAxis: {'title': 'predicted'},
    pointSize: 3,
    trendlines: { 0: {showR2: true, visibleInLegend: true} ,1: {showR2: true, visibleInLegend: true}}});
print(chartValidation);


//--------------------------------------------- CC Model ---------------------------------------------
print('------------- Training CC Model -------------')

var cc_training_featureCollection = ee.FeatureCollection('projects/ee-theonlyhayden/assets/Satellite_Embedding/cc_trainingData')
var cc_validation_featureCollection = ee.FeatureCollection('projects/ee-theonlyhayden/assets/Satellite_Embedding/cc_validationData')

var cc_predictors  = cc_training_featureCollection.first().propertyNames().filter(ee.Filter.neq('item','cover'))
                                                                    .filter(ee.Filter.neq('item','random'))
                                                                    .filter(ee.Filter.neq('item','class'))
                                                                    .filter(ee.Filter.neq('item','system:index'))

var cc_model = ee.Classifier.smileRandomForest(300)
  .setOutputMode('REGRESSION')
  .train({
    features: cc_training_featureCollection,
    classProperty: 'cover',
    inputProperties: cc_predictors
  });

// Get model's predictions for training samples
var cc_training_predicted = cc_training_featureCollection.classify({
  classifier: cc_model,
  outputName: 'cover_predicted'
});
var cc_training_rmse = calculateRmse('cover',cc_training_predicted);
print('RMSE', cc_training_rmse);

var chartTraining = ui.Chart.feature.byFeature(cc_training_predicted.limit(5000), 'cover', 'cover_predicted').setChartType('ScatterChart').setOptions({
    title: 'CC - Predicted vs Observed - Training data ',
    hAxis: {'title': 'observed'},
    vAxis: {'title': 'predicted'},
    pointSize: 3,
    trendlines: { 0: {showR2: true, visibleInLegend: true} ,1: {showR2: true, visibleInLegend: true}}});
print(chartTraining);


var cc_validation_predicted = cc_validation_featureCollection.classify({
  classifier: cc_model,
  outputName: 'cover_predicted'
});
var cc_validation_rmse = calculateRmse('cover',cc_validation_predicted);
print('RMSE', cc_validation_rmse);

var chartValidation = ui.Chart.feature.byFeature(cc_validation_predicted, 'cover', 'cover_predicted').setChartType('ScatterChart').setOptions({
    title: 'CC - Predicted vs Observed - Validation data ',
    hAxis: {'title': 'observed'},
    vAxis: {'title': 'predicted'},
    pointSize: 3,
    trendlines: { 0: {showR2: true, visibleInLegend: true} ,1: {showR2: true, visibleInLegend: true}}});
print(chartValidation);

//--------------------------------------------- Height Model ---------------------------------------------
print('------------- Training Height Model -------------')

var height_training_featureCollection = ee.FeatureCollection('projects/ee-theonlyhayden/assets/Satellite_Embedding/height_trainingData')
var height_validation_featureCollection = ee.FeatureCollection('projects/ee-theonlyhayden/assets/Satellite_Embedding/height_validationData')
                                                  .filter(ee.Filter.lt('rh98',20))

var height_predictors  = height_training_featureCollection.first().propertyNames().filter(ee.Filter.neq('item','rh98'))
                                                                    .filter(ee.Filter.neq('item','random'))
                                                                    .filter(ee.Filter.neq('item','class'))
                                                                    .filter(ee.Filter.neq('item','system:index'))

var height_model = ee.Classifier.smileRandomForest(300)
  .setOutputMode('REGRESSION')
  .train({
    features: height_training_featureCollection,
    classProperty: 'rh98',
    inputProperties: height_predictors
  });

// Get model's predictions for training samples
var height_training_predicted = height_training_featureCollection.classify({
  classifier: height_model,
  outputName: 'rh98_predicted'
});
var height_training_rmse = calculateRmse('rh98',height_training_predicted);
print('RMSE', height_training_rmse);

var chartTraining = ui.Chart.feature.byFeature(height_training_predicted.limit(5000), 'rh98', 'rh98_predicted').setChartType('ScatterChart').setOptions({
    title: 'Height - Predicted vs Observed - Training data ',
    hAxis: {'title': 'observed'},
    vAxis: {'title': 'predicted'},
    pointSize: 3,
    trendlines: { 0: {showR2: true, visibleInLegend: true} ,1: {showR2: true, visibleInLegend: true}}});
print(chartTraining);


var height_validation_predicted = height_validation_featureCollection.classify({
  classifier: height_model,
  outputName: 'rh98_predicted'
});
var height_validation_rmse = calculateRmse('rh98',height_validation_predicted);
print('RMSE', height_validation_rmse);

var chartValidation = ui.Chart.feature.byFeature(height_validation_predicted, 'rh98', 'rh98_predicted').setChartType('ScatterChart').setOptions({
    title: 'Height - Predicted vs Observed - Validation data ',
    hAxis: {'title': 'observed'},
    vAxis: {'title': 'predicted'},
    pointSize: 3,
    trendlines: { 0: {showR2: true, visibleInLegend: true} ,1: {showR2: true, visibleInLegend: true}}});
print(chartValidation);








// Functions
function getEmbeddings(start,end,geom){
  var embeddingsFiltered = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL')
                        .filter(ee.Filter.date(start, end))
                        .filter(ee.Filter.bounds(geom));
  return embeddingsFiltered
}

function getGEDI_Biomass(start,end,geom){
  var col = ee.ImageCollection("LARSE/GEDI/GEDI04_A_002_MONTHLY")
                  .filter(ee.Filter.date(start, end))
                  .filter(ee.Filter.bounds(geom))
                  .map(qualityMask_biomass)
                  .select('agbd')
                  .map(function(img){return img.mask(img.select('agbd').lte(500))})
                  .map(slopeMask);
  return col
}
function qualityMask_biomass(im) {
  var relative_se = im.select('agbd_se')
    .divide(im.select('agbd'));
  return im.updateMask(im.select('l4_quality_flag').eq(1))
      .updateMask(im.select('degrade_flag').eq(0))
      .updateMask(im.select('leaf_off_flag').eq(0))
      .updateMask(relative_se.lte(0.5))
      ;
}
function AGBD_timeEmbeddings(val){
  var startDate = ee.Date.fromYMD(val, 1, 1);
  var endDate = startDate.advance(1, 'year');
  var embeddingsFiltered = getEmbeddings(startDate,endDate,AOI)
  var embeddingsProjection = ee.Image(embeddingsFiltered.first()).select(0).projection();
  var embeddingsImage = embeddingsFiltered.mosaic()
  var gediProcessed = getGEDI_Biomass(startDate,endDate,AOI)
  var gediProjection = ee.Image(gediProcessed.first()).select('agbd').projection();
  var gediMosaic = gediProcessed.mosaic().select('agbd')
  var stacked = embeddingsImage.addBands(gediMosaic).setDefaultProjection(gediProjection);
  stacked = stacked.resample('bilinear')
  var stackedResampled = stacked.reduceResolution({
                                    reducer: ee.Reducer.mean(),
                                    maxPixels: 1024}).reproject({crs: gridProjection});
  stackedResampled = stackedResampled.updateMask(stackedResampled.mask().gt(0));
  var predictors = embeddingsImage.bandNames();
  var predicted = gediMosaic.bandNames().get(0);
  var predictorImage = stackedResampled.select(predictors);
  var predictedImage = stackedResampled.select([predicted]);
  var classMask = predictedImage.mask().toInt().rename('class');
  var featureData = stackedResampled.addBands(classMask)
                                    .stratifiedSample({
                                      numPoints: numSamples,
                                      classBand: 'class',
                                      region: AOI,
                                      scale: gridScale,
                                      classValues: [0, 1],
                                      classPoints: [0, numSamples],
                                      dropNulls: true,
                                      tileScale: 16,
                                      geometries: true})
  return ee.FeatureCollection(featureData)
}

function getGEDI_CC(start, end, geom){
  var col = ee.ImageCollection('LARSE/GEDI/GEDI02_B_002_MONTHLY')
                  .filter(ee.Filter.date(start, end))
                  .filter(ee.Filter.bounds(geom))
                  .map(qualityMask_CC)
                  .map(slopeMask)
                  .select('cover');
  return col
}
function qualityMask_CC (im) {
  return im.updateMask(im.select('l2b_quality_flag').eq(1))
      .updateMask(im.select('degrade_flag').eq(0))}
function CC_timeEmbeddings(val){
  var startDate = ee.Date.fromYMD(val, 1, 1);
  var endDate = startDate.advance(1, 'year');
  var embeddingsFiltered = getEmbeddings(startDate,endDate,AOI)
  var embeddingsProjection = ee.Image(embeddingsFiltered.first()).select(0).projection();
  var embeddingsImage = embeddingsFiltered.mosaic()
  var gediProcessed = getGEDI_CC(startDate,endDate,AOI)
  var gediProjection = ee.Image(gediProcessed.first()).select('cover').projection();
  var gediMosaic = gediProcessed.mosaic().select('cover')
  var stacked = embeddingsImage.addBands(gediMosaic).setDefaultProjection(gediProjection);
  stacked = stacked.resample('bilinear')
  var stackedResampled = stacked.reduceResolution({
                                    reducer: ee.Reducer.mean(),
                                    maxPixels: 1024}).reproject({crs: gridProjection});
  stackedResampled = stackedResampled.updateMask(stackedResampled.mask().gt(0));
  var predictors = embeddingsImage.bandNames();
  var predicted = gediMosaic.bandNames().get(0);
  var predictorImage = stackedResampled.select(predictors);
  var predictedImage = stackedResampled.select([predicted]);
  var classMask = predictedImage.mask().toInt().rename('class');
  var featureData = stackedResampled.addBands(classMask)
                                    .stratifiedSample({
                                      numPoints: numSamples,
                                      classBand: 'class',
                                      region: AOI,
                                      scale: gridScale,
                                      classValues: [0, 1],
                                      classPoints: [0, numSamples],
                                      dropNulls: true,
                                      tileScale: 16,
                                      geometries: true})
  return ee.FeatureCollection(featureData)
}

function getGEDI_height(start, end, geom){
  var col = ee.ImageCollection("LARSE/GEDI/GEDI02_A_002_MONTHLY")
                  .filter(ee.Filter.date(start, end))
                  .filter(ee.Filter.bounds(geom))
                  .map(qualityMask_height)
                  .map(slopeMask)
                  .select('rh98');
  return col
}
function qualityMask_height(im) {
  return im.updateMask(im.select('quality_flag').eq(1))
      .updateMask(im.select('degrade_flag').eq(0))
}
function height_timeEmbeddings(val){
  var startDate = ee.Date.fromYMD(val, 1, 1);
  var endDate = startDate.advance(1, 'year');
  var embeddingsFiltered = getEmbeddings(startDate,endDate,AOI)
  var embeddingsProjection = ee.Image(embeddingsFiltered.first()).select(0).projection();
  var embeddingsImage = embeddingsFiltered.mosaic()
  var gediProcessed = getGEDI_height(startDate,endDate,AOI)
  var gediProjection = ee.Image(gediProcessed.first()).select('rh98').projection();
  var gediMosaic = gediProcessed.mosaic().select('rh98')
  var stacked = embeddingsImage.addBands(gediMosaic).setDefaultProjection(gediProjection);
  stacked = stacked.resample('bilinear')
  var stackedResampled = stacked.reduceResolution({
                                    reducer: ee.Reducer.mean(),
                                    maxPixels: 1024}).reproject({crs: gridProjection});
  stackedResampled = stackedResampled.updateMask(stackedResampled.mask().gt(0));
  var predictors = embeddingsImage.bandNames();
  var predicted = gediMosaic.bandNames().get(0);
  var predictorImage = stackedResampled.select(predictors);
  var predictedImage = stackedResampled.select([predicted]);
  var classMask = predictedImage.mask().toInt().rename('class');
  var featureData = stackedResampled.addBands(classMask)
                                    .stratifiedSample({
                                      numPoints: numSamples,
                                      classBand: 'class',
                                      region: AOI,
                                      scale: gridScale,
                                      classValues: [0, 1],
                                      classPoints: [0, numSamples],
                                      dropNulls: true,
                                      tileScale: 16,
                                      geometries: true})
  return ee.FeatureCollection(featureData)
}




function slopeMask(image,geom) {
  var glo30 = ee.ImageCollection('COPERNICUS/DEM/GLO30');
  var glo30Filtered = glo30
    .select('DEM');
  var demProj = glo30Filtered.first().select(0).projection();
  var elevation = glo30Filtered.mosaic().rename('dem')
    .setDefaultProjection(demProj);
  var slope = ee.Terrain.slope(elevation);
  return image.updateMask(slope.lt(30));
}
function calculateRmse(type,input) {
    var observed = ee.Array(
      input.aggregate_array(type));
    var predicted = ee.Array(
      input.aggregate_array(type + '_predicted'));
    var rmse = observed.subtract(predicted).pow(2)
      .reduce('mean', [0]).sqrt().get([0]);
    return rmse;
}
