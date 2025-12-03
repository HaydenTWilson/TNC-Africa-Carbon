# REDD+ Tools
The Scripts in this repo have been developed with the aim of assisting projects develop an ex-ante estimation of the likely future rates of deforestation within their projects jurisdiction.
The outputs do not serve as a replacement to the official risk maps published by verra, but rather as a stand in - interim version which can be used in conjunction with other tools 
in this repository to estimate the likely baseline rates of deforestation a project will experience during the Baseline validity period.

The scripts have been developed to be used in conjunction with the Clarklab Udef-ARP tool, available at https://github.com/ClarkCGA/UDef-ARP.

## The VM00048 Risk Mapping tool
The tool has been designed to run in Google Earth Engine and utilises a random forest in regression mode to produce a deforestation probability value between 0 and 1. 
The tool is trained on multiple historical temporal periods, with deforestation activity from the subsequent temporal period used as labels.

Inputs include:
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

The script has been configured to take a single input - a point in the jurisdiction that will be modelled. It produces a Jurisdictional deforestation probability map which is valid for the period spanning 2022 - 2028.
