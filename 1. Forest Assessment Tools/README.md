# Forest Assessment Tools

The Forest Assessment Tools published here are designed to run in Google Earth Engine. 
They are an ML based method for generating continuous surface predictions of Canopy cover, Canopy Height and Aboveground Biomass Density for a given temporal period. 

The RandomForest classifier is trained using GEDI data as labels, with Sentinel 1 SAR, Sentinel 2 and elevation data as inputs.

This Repo contains two files:
1. The script for use in Earth Engine
2. A case study showcasing the use of the script in generating forest cover maps for use in forest inventory planning or forest cover benchmark maps.

the workflow the tool follows is:
1. Gather the GEDI data for the region of interest
2. Mask/remove GEDI observations which do not meet the quality parameters
3. Split the GEDI data into training and test subsets
4. Create the input images.
   a.   Sentinel 2
     i.)    Remove clouds using the Google Cloud Score+
     ii.)   Filter the imageCollection to include images from the desired date range
             a. a set of images from the immediate post rainy season period
             b. a set of images from the late dry season period (immediately prior to the onset of the wet season)
     iii.)  Calculate a suite of vegetation indices for each collection and rename them based on the season that they are from
     iv.)   Calculate the mean composite for each season
     v.)    Combine the two seasons into a single image containing image bands for both the wet and dry seasons
   b.  Sentinel 1
     i.)    
