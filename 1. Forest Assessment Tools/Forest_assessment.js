// Welcome to the Canopy cover and Biomass change analysis script!
// This script is designed to allow you to detect and track changes in canopy cover and biomass within your project region over time.
// It utilizes a model which is trained on the GEDI space born Lidar instrument to predict canopy cover and aboveground woody biomass from Sentinel 2 Data
// The process to follow is to first train your models on a smaller area, and then use that trained model to predict biomass and canopy cover over multiple time periods.
// if you are finding that the model is not performing well, try expanding the training_AOI and look to filtering the GEDI data used in training.
// The time periods to use need to be annual, as the model uses data from immediately post the rainy season and at the end of the dry season to predict the model outputs.
// After the model has been trained, each years worth of data is added to an image collection, which is then analyzed for change using a simple linear regression.
// The model outputs can then be exported to google drive.

// Note: the script is designed to take 2 geometry inputs: 
//       the first is for training the canopy cover and biomass model
//       the second is for creating the output datasets from the various analyses

var AOI = ee.Geometry.Polygon(
        [[[29.678467836789768, -5.882320166921315],
          [29.678467836789768, -6.5758288725027265],
          [30.307435121946018, -6.5758288725027265],
          [30.307435121946018, -5.882320166921315]]], null, false);
var training_AOI = 
    ee.Geometry.Polygon(
        [[[30.062989321164768, -6.119963124255552],
          [30.062989321164768, -6.278333324491578],
          [30.216797914914768, -6.278333324491578],
          [30.216797914914768, -6.119963124255552]]], null, false);


Map.centerObject(AOI,12)

// Option A - use a smaller training_AOI to generate the training data.
//Step 1 - Define the parameters used for cloud Masking
// Parameters for the cloud masking algorithm

var csPlus = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED");
var QA_BAND = 'cs_cdf';
var CLEAR_THRESHOLD = 0.70;
var biomass_cutoff = 500

// Step 2 - Train the Classifiers
// notes: The dates below follow the following sequence [PRS_start,PRS_end,DS_start,DS_end], 
//        PRS = Post rainy season i.e. the time after the rains when everything is green
//        DS = Dry Season i.e. the time a while after the rains where everything is brown
//        If the computation times out here, then reduce the size of the polygon you are using to define the training region

// ------------------------------------------ use a smaller training_AOI to generate the training data  -------------------------------------------------------------------------------------

var sample_pixels = 240000 //adjust this value until the analysis times out - then reduce to a value that works

var agb_model = trainClassifier('agbd',training_AOI,'2024-05-01','2024-06-30','2024-07-01','2024-09-30') //Create and Test aboveground biomass model
var cc_model = trainClassifier('cover',training_AOI,'2024-05-01','2024-06-30','2024-07-01','2024-09-30') //Create and Test Canopy Cover model
var height_model = trainClassifier('rh98',training_AOI,'2024-05-01','2024-06-30','2024-07-01','2024-09-30') //Create and Test Canopy Height model

// Step 3 - Create the biomass and Canopy cover Model outputs for the years you are interested in

var img_2025 = CreateImgCol('2024-05-01','2024-06-30','2024-07-01','2024-09-30', AOI)
var agb = img_2025.classify(agb_model, 'predicted_agb')
var cc = img_2025.classify(cc_model, 'predicted_cc')
var height = img_2025.classify(height_model, 'predicted_height')



Map.addLayer(img_2025,{bands:['PRS_B4', 'PRS_B3', 'PRS_B2'], min:0.04, max: 0.3, gamma:1.1},'PRS 2025')
Map.addLayer(img_2025,{bands:['DS_B4', 'DS_B3', 'DS_B2'], min:0.04, max: 0.3, gamma:1.1},'DS 2025')



Map.addLayer(cc, {min:0, max:1, palette:['black', 'green']}, 'Canopy 2025')
Map.addLayer(agb, {min:23, max:77, palette:['red','orange','yellow','green','blue','purple']}, 'AGB 2025')
Map.addLayer(height, {min:6, max:16, palette:['red','orange','yellow','green','blue','purple']}, 'Height 2025')


//Select the data you need for export
var export_image = agb.addBands([cc, height])


// Export the data
Export.image.toDrive({
  image: export_image.toFloat(),
  description: 'agb_cc_2024',
  folder: 'XXXX', //Add your google drive folder name
  scale: 30,
  maxPixels: 1e13,
  region: AOI
});


// -------------- useful tools --------
//get the min and max values for a region of interest 

var max = height.reduceRegion({
  reducer: ee.Reducer.max(), 
  geometry: training_AOI, 
  scale: 5000, 
  maxPixels: 1e13
});

print('max:',max)

var min = height.reduceRegion({
  reducer: ee.Reducer.min(), 
  geometry: training_AOI, 
  scale: 5000, 
  maxPixels: 1e13
});

print('min:',min)


//---------------Functions--------------------------
function trainClassifier(type,geometry,PRS_start,PRS_end,DS_start,DS_end){
  var TrainingCollection = CreateImgCol(PRS_start,PRS_end,DS_start,DS_end, geometry)
  var bands = ee.List(TrainingCollection.bandNames());
  if (type == 'agbd'){
    print('---------Training Aboveground Biomass Classifier ---------')
    var dataset = getGEDI_Biomass(geometry)
    var projection = dataset.first().projection();
    var scale = projection.nominalScale();
    var mosaic = dataset.mosaic().reproject({crs: projection,scale: scale}).clip(geometry)
    var dataList = getPoints(mosaic,geometry, scale, projection)
    var trainingData = ee.List(dataList).get(0);
    var validationData = ee.List(dataList).get(1);
    var training = TrainingCollection.select(bands).sampleRegions({
      collection: trainingData,
      properties: ['agbd'],
      scale: 30 // Can change the scale of training data to avoid the 'out of memory' problem
      });
    var agbd_classifier = ee.Classifier.smileRandomForest(100).setOutputMode('REGRESSION').train({
      features: training, 
      classProperty: type,
      inputProperties: bands});
    var test_img = TrainingCollection.classify(agbd_classifier, 'predicted').clip(geometry);
    test_classifier('agbd',agbd_classifier, trainingData,validationData,test_img)
    return agbd_classifier
  }
  if (type == 'rh98'){
    print('---------Training Height Classifier ---------')
    var dataset3 = getGEDI_height(geometry)
    var projection3 = dataset3.first().projection();
    var scale3 = projection3.nominalScale();
    var mosaic3 = dataset3.mosaic().reproject({crs: projection3,scale: scale3}).clip(geometry)
    var dataList3 = getPoints(mosaic3,geometry, scale, projection3)
    var trainingData3 = ee.List(dataList3).get(0);
    var validationData3 = ee.List(dataList3).get(1);
    var training3 = TrainingCollection.select(bands).sampleRegions({
      collection: trainingData3,
      properties: ['rh98'],
      scale: 30 // Can change the scale of training data to avoid the 'out of memory' problem
      });
    var height_classifier = ee.Classifier.smileRandomForest(100).setOutputMode('REGRESSION').train({
      features: training3, 
      classProperty: type,
      inputProperties: bands});
    var test_img3 = TrainingCollection.classify(height_classifier, 'predicted').clip(geometry);
    test_classifier('rh98',height_classifier, trainingData3,validationData3,test_img3)
    return height_classifier
  }
  else {
    print('---------Training Canopy Cover Classifier ---------')
    var dataset_2 = getGEDI_CC(geometry)
    var projection2 = dataset_2.first().projection();
    var scale2 = projection2.nominalScale();
    var mosaic2 = dataset_2.mosaic().reproject({crs: projection2,scale: scale2}).clip(geometry)
    var dataList2 = getPoints(mosaic2,geometry)
    var trainingData2 = ee.List(dataList2).get(0);
    var validationData2 = ee.List(dataList2).get(1);
    var training2 = TrainingCollection.select(bands).sampleRegions({
      collection: trainingData2,
      properties: ['cover'],
      scale: 30 // Can change the scale of training data to avoid the 'out of memory' problem
      });
    var CC_classifier = ee.Classifier.smileRandomForest(100).setOutputMode('REGRESSION').train({
      features: training2, 
      classProperty: type,
      inputProperties: bands});
    var test_img2 = TrainingCollection.classify(CC_classifier, 'predicted').clip(geometry);
    test_classifier('cover',CC_classifier, trainingData2,validationData2,test_img2)  
    return CC_classifier
  }
}


function test_classifier(type,classifier, trainingData_input,validationData_input,test_img_input){
  var classifier_details = classifier.explain();
  var variable_importance = ee.Feature(null, ee.Dictionary(classifier_details).get('importance'));
  var predictedTraining = test_img_input.sampleRegions({collection:trainingData_input, geometries: true});
  var sampleTraining = predictedTraining.select([type, 'predicted']);
  var observationTraining = ee.Array(sampleTraining.aggregate_array(type));
  var predictionTraining = ee.Array(sampleTraining.aggregate_array('predicted'));
  var residualsTraining = observationTraining.subtract(predictionTraining);
  var rmseTraining = residualsTraining.pow(2).reduce('mean', [0]).sqrt();
  print('Training RMSE', rmseTraining);
  var predictedValidation = test_img_input.sampleRegions({collection:validationData_input, geometries: true});
  var sampleValidation = predictedValidation.select([type, 'predicted']);
  var observationValidation = ee.Array(sampleValidation.aggregate_array(type));
  var predictionValidation = ee.Array(sampleValidation.aggregate_array('predicted'));
  var residualsValidation = observationValidation.subtract(predictionValidation);
  var rmseValidation = residualsValidation.pow(2).reduce('mean', [0]).sqrt();
  print('Validation RMSE', rmseValidation)
  var chart = ui.Chart.feature.byProperty(variable_importance).setChartType('ColumnChart').setOptions({
    title: 'Random Forest Variable Importance',
    legend: {position: 'none'},
    hAxis: {title: 'Bands'},
    vAxis: {title: 'Importance'}});
  print("Variable importance:", chart);
  var chartTraining = ui.Chart.feature.byFeature(sampleTraining, type, 'predicted').setChartType('ScatterChart').setOptions({
    title: 'Predicted vs Observed - Training data ',
    hAxis: {'title': 'observed'},
    vAxis: {'title': 'predicted'},
    pointSize: 3,
    trendlines: { 0: {showR2: true, visibleInLegend: true} ,1: {showR2: true, visibleInLegend: true}}});
  print(chartTraining);
  var chartValidation = ui.Chart.feature.byFeature(sampleValidation, 'predicted', type).setChartType('ScatterChart').setOptions({
    title: 'Predicted vs Observed - Validation data',
    hAxis: {'title': 'predicted'},
    vAxis: {'title': 'observed'},
    pointSize: 3,
    trendlines: { 0: {showR2: true, visibleInLegend: true} ,1: {showR2: true, visibleInLegend: true}}});
  print(chartValidation);
}

//Function to Rename the Sentinel 2 Bands
function sentinelBands(image){
  image = ee.Image(image);
  var bandsFrom = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12', 'TCI_R', 'TCI_G', 'TCI_B'];
  var bandsTo = ['blue', 'green', 'red', 're1', 're2', 're3', 'nir', 're4', 'swir1', 'swir2', 'TCI_R', 'TCI_G', 'TCI_B'];
  var scaleS2Bands = ee.Image([0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 1, 1, 1]);
  return image.select(bandsFrom)
    .rename(bandsTo)
    .multiply(scaleS2Bands)
    .copyProperties(image, ["system:time_start"]);
}

//Function to calculate all the vegetation indices for the image collection
function s2Process(image){
  var ARI = calcARI(image);
  var NDVI = calcNDVI(image);
  var MSAVI = calcMSAVI(image);
  var NDWI = calcNDWI(image);
  var MNDWI = calcMNDWI(image);
  var PSRI = calcPSRI(image);
  var REIP = calcREIP(image);
  
  return image.addBands([
    ARI, NDVI, MSAVI, NDWI, MNDWI, PSRI, REIP
    ]);
}

//Functions for calculating the various indices
function calcARI(image, addBand){
  image = ee.Image(image);
  var ari = image.expression({
    expression: "(nir / blue) - (nir / green)",
    map: {
      "nir": image.select('nir'),
      "blue": image.select('blue'),
      "green": image.select('green')
    }
  }).rename('ari');

  if (addBand){
    return image.addBands(ari)
      .copyProperties(image, ["system:time_start"]);
  } else {
    return ari.copyProperties(image, ["system:time_start"]);
  }
}
function calcNDVI(image, addBand){
  image = ee.Image(image);
  var ndvi = image.normalizedDifference(["nir", "red"])
    .rename("ndvi");
    
  if (addBand){
    return image.addBands(ndvi)
      .copyProperties(image, ["system:time_start"]);
  } else {
    return ndvi.copyProperties(image, ["system:time_start"]);
  }
}
function calcMSAVI(image, addBand){
  image = ee.Image(image);
  var msavi = image.expression({
    expression: "0.5 * (2.0 * nir + 1 - (((2 * nir + 1) ** 2) - 8 * (nir - red)) ** 0.5)",
    map: {
      "nir": image.select("nir"),
      "red": image.select("red")
    }
  }).rename('msavi');
  
  if (addBand){
    return image.addBands(msavi)
      .copyProperties(image, ["system:time_start"]);
  } else {
    return msavi.copyProperties(image, ["system:time_start"]);
  }
}
function calcNDWI(image, addBand){
  image = ee.Image(image);
  var ndwi = image.normalizedDifference(["green", "nir"])
    .rename('ndwi');

  if (addBand){
    return image.addBands(ndwi)
      .copyProperties(image, ["system:time_start"]);
  } else {
    return ndwi.copyProperties(image, ["system:time_start"]);
  }
}
function calcMNDWI(image, addBand){
  image = ee.Image(image);
  var mndwi = image.normalizedDifference(["green", "swir1"])
    .rename('mndwi');

  if (addBand){
    return image.addBands(mndwi)
      .copyProperties(image, ["system:time_start"]);
  } else {
    return mndwi.copyProperties(image, ["system:time_start"]);
  }
}
function calcPSRI(image, addBand){
  image = ee.Image(image);
  var psri = image.expression({
    expression: "(red - blue) / re1",
    map: {
      "red": image.select("red"),
      "blue": image.select("blue"),
      "re1": image.select('re1')
    }
  }).rename("psri");
    
  if (addBand){
    return image.addBands(psri)
      .copyProperties(image, ["system:time_start"]);
  } else {
    return psri.copyProperties(image, ["system:time_start"]);
  }
}
function calcREIP(image, addBand){
  image = ee.Image(image);
  var reip = image.expression({
    expression: "702 + 40*((red+re3)/2 - re1)/(re2 - re1)",
    // expression: "705 + (35 * ((((red + re3) / 2) - re1) / (re2 - re1)))",
    map: {
      'red': image.select('red'),
      're1': image.select('re1'),
      're2': image.select('re2'),
      're3': image.select('re3'),
  }})//.divide(1000)
    .rename('reip');

  if (addBand){
    return image.addBands(reip)
      .copyProperties(image, ["system:time_start"]);
  } else {
    return reip.copyProperties(image, ["system:time_start"]);
  }
}

// Function to get the Sentinel 1 variables - 
// note, the S1 imagecollection in earth engine is a bit patchy, so sometimes this fails and you need to exclude S1 from the analysis
function getS1(geom,date1,date2){
  var S1 = ee.ImageCollection('COPERNICUS/S1_GRD')
              .filterDate(date1,date2)
              .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
              .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
              .filter(ee.Filter.eq('instrumentMode', 'IW'))
              .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
              .filterBounds(geom);
  var S1_pc = (ee.Image(10).pow((S1.reduce(ee.Reducer.percentile([25,50,75]))).divide(10))).clip(geom);
  var S1_pc_Feats = S1_pc.select(['VH_p50','VV_p50']).clip(geom).reproject({crs: 'EPSG:32735',scale: 30})
  var VV_iqr = S1_pc_Feats.addBands((S1_pc.select('VV_p75').subtract(S1_pc.select('VV_p25'))).rename('VV_iqr'))
  var VH_iqr = S1_pc_Feats.addBands((S1_pc.select('VH_p75').subtract(S1_pc.select('VH_p25'))).rename('VH_iqr'));
  return VH_iqr.select('VH_iqr').addBands(VV_iqr.select('VV_iqr'))
}

//Function to mask the S2 images using the google cloudscore+ dataset
function maskClouds(img){
  return img.updateMask(img.select(QA_BAND).gte(CLEAR_THRESHOLD));
}

function addYear(img){
  var year = img.date().get('year')
  var yearImage = ee.Image(year).rename('year')
  return img.addBands([yearImage])
}

//Function to get the S2 images, apply the cloud mask and calculate the various indices - it finally outputs the median image.
function getS2(geom,date1,date2){
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');
  var csPlus = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED");
  var QA_BAND = 'cs_cdf';
  var CLEAR_THRESHOLD = 0.70;
  var composite = s2.filterDate(date1, date2)
                  // Pre-filter to get less cloudy granules.
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
                  .linkCollection(csPlus, [QA_BAND])
                  .map(maskClouds)
                  .map(sentinelBands)
                  .map(addYear)                  
                  .select('blue', 'green', 'red', 're1', 're2', 're3', 'nir', 're4', 'swir1', 'swir2','year');
  var S2_median = composite.median().clip(geom).reproject({crs: 'EPSG:32735', scale: 30});
  return S2_median
}

// Function for getting Slope and elevation data
function getSRTM(geom){
  var elevation = ee.Image("USGS/SRTMGL1_003").reproject({crs: 'EPSG:32735',scale: 30}).clip(geom);
  var slope = ee.Terrain.slope(elevation);
  return elevation.addBands(slope)
}

// Function for masking the GEDI canopy cover data based on a data quality flag
function qualityMask_CC (im) {
  return im.updateMask(im.select('l2b_quality_flag').eq(1))
      .updateMask(im.select('degrade_flag').eq(0))}

// Function for masking the GEDI biomass data based on a data quality flag
function qualityMask_biomass(im) {
  var relative_se = im.select('agbd_se')
    .divide(im.select('agbd'));
  return im.updateMask(im.select('l4_quality_flag').eq(1))
      .updateMask(im.select('degrade_flag').eq(0))
      .updateMask(im.select('leaf_off_flag').eq(0))
      .updateMask(relative_se.lte(0.5))
      ;
}

function qualityMask_height(im) {
  return im.updateMask(im.select('quality_flag').eq(1))
      .updateMask(im.select('degrade_flag').eq(0))
}


//function to get and apply a forest area mask
// Load ESA World cover data
function GetforestMask(geom){
  var ESA_LC_2021 = ee.ImageCollection("ESA/WorldCover/v200").first().clip(geom);
  var forest_mask = ESA_LC_2021.updateMask(ESA_LC_2021.eq(10)).rename('forest_mask');
  return forest_mask
}


//function to get the GEDI biomass data used for algorithm training 
function getGEDI_Biomass(geom){
  var col = ee.ImageCollection("LARSE/GEDI/GEDI04_A_002_MONTHLY")
                  .map(qualityMask_biomass)
                  .select('agbd').filterBounds(geom)
                  .map(function(img){ return img.mask(img.select('agbd').lte(500))}); // filter out the incorrect data from GEDI
  return col
}      

//function to get the GEDI Canopy cover data used for algorithm training 
function getGEDI_CC(geom){
  var col = ee.ImageCollection('LARSE/GEDI/GEDI02_B_002_MONTHLY')
                  .map(qualityMask_CC)
                  .select('cover').filterBounds(geom);
  return col
}

//function to get the GEDI height data for algorithm training
function getGEDI_height(geom){
  var col = ee.ImageCollection("LARSE/GEDI/GEDI02_A_002_MONTHLY")
                  .map(qualityMask_height)
                  .select('rh98').filterBounds(geom)
  return col
}


// function to get the GEDI points and split them into training and validation subsets based on a random seed
function getPoints(col,geom, scaleVal,ProjVal){
  var points = col.sample({
    region: geom,
    scale: scaleVal,
    numPixels: sample_pixels, 
    projection: ProjVal,
    geometries: true});
  var datawithColumn = points.randomColumn('random', 27);
  var split = 0.7; 
  var trainingData = datawithColumn.filter(ee.Filter.lt('random', split));
  var validationData = datawithColumn.filter(ee.Filter.gte('random', split));
  return [trainingData, validationData];
}

// function to assemble to covariates into a collection to be used in the classification
function CreateImgCol (PRS_start,PRS_end,DS_start,DS_end, geom){
  var PRS_S1_iqr  = getS1(geom,PRS_start,PRS_end);
  var DS_S1_iqr  = getS1(geom,DS_start,DS_end);
  var PRS_S2_composite = getS2(geom,PRS_start,PRS_end);
  PRS_S2_composite = s2Process(PRS_S2_composite)
    .rename(['PRS_B2', 'PRS_B3', 'PRS_B4', 'PRS_B5', 'PRS_B6', 'PRS_B7', 'PRS_B8','PRS_B8A', 'PRS_B11', 'PRS_B12','PRS_ari','PRS_ndvi','PRS_msavi','PRS_ndwi','PRS_mndwi','PRS_psri','PRS_reip', 'PRS_year']);
  var DS_S2_composite = getS2(geom,DS_start,DS_end);
  DS_S2_composite = s2Process(DS_S2_composite)
    .rename(['DS_B2', 'DS_B3', 'DS_B4', 'DS_B5', 'DS_B6', 'DS_B7', 'DS_B8','DS_B8A', 'DS_B11', 'DS_B12','DS_ari','DS_ndvi','DS_msavi','DS_ndwi','DS_mndwi','DS_psri','DS_reip', 'DS_year']);
  var range = PRS_S2_composite.subtract(DS_S2_composite)
  var SRTM = getSRTM(geom);
  var forest_mask = GetforestMask(geom)
  var height_data = ee.ImageCollection('projects/meta-forest-monitoring-okw37/assets/CanopyHeight').filterBounds(geom).mosaic().clip(geom);
  var tree_cover = ee.Image("projects/sat-io/open-datasets/PS_AFRICA_TREECOVER_2019_100m_V10").clip(geom);
  var Collection = PRS_S2_composite
  .addBands(DS_S2_composite)
  // .addBands(range)
  .addBands(PRS_S1_iqr)
  .addBands(DS_S1_iqr)
  .addBands(SRTM)
  // .addBands(height_data)
  // .addBands(tree_cover)
  // .addBands(forest_mask); // Optional - Apply forest mask to constrain the data that is used for training to only forest areas
  return Collection;
}