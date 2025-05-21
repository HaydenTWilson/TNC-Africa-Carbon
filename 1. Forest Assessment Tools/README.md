# Forest Assessment Tools

The Forest Assessment Tools published here are designed to run in Google Earth Engine. 
They are an ML based method for generating continuous surface predictions of Canopy cover, Canopy Height and Aboveground Biomass Density for a given temporal period. 

The RandomForest classifier is trained using GEDI data as labels, with Sentinel 1 SAR, Sentinel 2 and elevation data as inputs.

This Repo contains two files:
1. The script for use in Earth Engine
2. A case study showcasing the use of the script in generating forest cover maps for use in forest inventory planning or forest cover benchmark maps.

## Script Workflow
### Model Training
1. Gather the GEDI data for the region of interest
2. Mask/remove GEDI observations which do not meet the quality parameters
3. Split the GEDI data into training and test subsets
4. Create the input images.
   - Sentinel 2
      - Remove clouds using the Google Cloud Score+
      - Filter the imageCollection to include images from the desired date range
         - a set of images from the immediate post rainy season period
         - a set of images from the late dry season period (immediately prior to the onset of the wet season)
      - Calculate a suite of vegetation indices for each collection and rename them based on the season that they are from
      - Calculate the median composite for each season
      - Combine the two seasons into a single image containing image bands for both the wet and dry seasons
   - Sentinel 1
      -  Filter the imageCollection to include images from the desired date range
      -  Filter the imageCollection so it only contains images with 'VV' and 'VH' polarisation, the instrument was in 'IW' mode and the orbit was an ascending orbit.
      -  Seperate the imageCollection into two different collections
         - a set of images from the immediate post rainy season period
         - a set of images from the late dry season period (immediately prior to the onset of the wet season)
      -  Calculate Inter Quartile ranges for each collection
      -  Combine the two seasons into a single image containing image bands for both the wet and dry seasons
   - SRTM
      -  Clip the Image to the Region of Interest
      -  Calculate slope angle
      -  Add slope as a band to the clipped elevation image
6. Combine the Sentinel 2, Sentinel 1 and SRTM images into a single multiband image which is used for training and validation
7. Train the Random Forest Classifier
   - at each GEDI training point, sample the training + validation image to create a training array.
   - train the random forest classifier in regression mode using the image from the training array and the GEDI point value as a label
   - generate a prediction of the GEDI value using the training array to assess within Model Error
   - Test the Random Forest Classifier by generating a prediction of GEDI values and then comparing them to the validation dataset (out of Model/True Error)
10. Generate Image Collection for the temporal period/ area of interest.
11. Classify the image using the trained classifier.
