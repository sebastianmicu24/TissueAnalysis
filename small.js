importClass(Packages.ij.IJ);
importClass(Packages.ij.ImagePlus);
importClass(Packages.ij.WindowManager);
importClass(Packages.ij.io.DirectoryChooser);
importClass(Packages.ij.gui.GenericDialog);
importClass(Packages.ij.plugin.frame.RoiManager);
importClass(Packages.ij.gui.Roi);
importClass(Packages.ij.gui.ShapeRoi);
importClass(Packages.java.io.File);
importClass(Packages.trainableSegmentation.WekaSegmentation);
importClass(Packages.trainableSegmentation.utils.Utils);
importClass(Packages.javax.swing.JFrame);
importClass(Packages.javax.swing.JTextArea);
importClass(Packages.java.awt.Font);
importClass(Packages.ij.process.ImageProcessor);
importClass(Packages.ij.ImageStack);
importClass(Packages.ij.process.LUT);
importClass(Packages.ij.measure.ResultsTable);
importClass(Packages.ij.process.ImageStatistics);
importClass(Packages.ij.measure.Measurements);
importClass(Packages.fiji.util.gui.GenericDialogPlus);

//################# Global variables ##################
var rm;
var TISSUE_THRESHOLD = 215;
var TISSUE_FRAGMENT_MIN_SIZE = 0;
var VESSEL_MIN_SIZE = 6000;
var VESSEL_MAX_SIZE = 10000000;
var startTime = java.lang.System.currentTimeMillis();

// Color deconvolution values
var r1 = 0.42944714;
var g1 = 0.7893987;
var b1 = 0.4386625;
var r2 = 0.26378345;
var g2 = 0.8046116;
var b2 = 0.53199476;
var r3 = 0.52136904;
var g3 = 0.5878762;
var b3 = 0.61852723;

// Processing parameters
var maxMemory = 1024;
var classifierPath = "C:\\Users\\sebas\\Desktop\\Microscopy\\98 Data ML\\Hematoxylin.model";
var folderPath = "";
var nuclearThreshold = 180;
var minNuclearSize = 20;
var minNuclearCircularity = 0.10;
var inputFolderPath = "C:\\Users\\sebas\\Desktop\\Microscopy\\03 Stitched";

//################# Secondary Functions ##################
// Function to get user input for analysis parameters
function getUserInput() {
    var gd = new GenericDialogPlus("Set Analysis Parameters");
    
    // Create main panel with GridBagLayout
    var mainPanel = new java.awt.Panel();
    mainPanel.setLayout(new java.awt.GridBagLayout());
    var c = new java.awt.GridBagConstraints();
    c.fill = java.awt.GridBagConstraints.HORIZONTAL;
    c.anchor = java.awt.GridBagConstraints.WEST;
    c.insets = new java.awt.Insets(5, 5, 5, 5);
    
    // Add checkboxes for processing options
    gd.addCheckbox("The images have visible Veins/Arteries", false);
    gd.addCheckbox("The images have a visible background", false);
    gd.addCheckbox("The images have missing/black parts at the edges (image is not square/rectangular)", false);
    
    // Add the rest of the input fields
    gd.addDirectoryField("Input Folder:", inputFolderPath);
    gd.addFileField("Classifier Path:", classifierPath);
    
    gd.addNumericField("Tissue Threshold (0-255):", TISSUE_THRESHOLD, 0);
    gd.addNumericField("Minimum Tissue Fragment Size (px^2):", TISSUE_FRAGMENT_MIN_SIZE, 0);
    gd.addNumericField("Vessel Min Size (px^2):", VESSEL_MIN_SIZE, 0);
    gd.addNumericField("Vessel Max Size (px^2):", VESSEL_MAX_SIZE, 0);
    gd.addNumericField("Segmentation maximum tile size (Lower if you have low RAM):", maxMemory, 0);
    gd.addNumericField("Nuclear Threshold (0-255):", nuclearThreshold, 0);
    gd.addNumericField("Min Nuclear Size (px^2):", minNuclearSize, 0);
    gd.addNumericField("Min Nuclear Circularity (0.00-1.00):", minNuclearCircularity, 2);
    
    // Add color deconvolution panel
    var colorPanel = new java.awt.Panel();
    colorPanel.setLayout(new java.awt.GridBagLayout());
    
    var colorPanel1 = new java.awt.Panel(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT, 5, 0));
    var r1Field = new java.awt.TextField(String(r1), 8);
    var g1Field = new java.awt.TextField(String(g1), 8);
    var b1Field = new java.awt.TextField(String(b1), 8);
    colorPanel1.add(new java.awt.Label("R1:"));
    colorPanel1.add(r1Field);
    colorPanel1.add(new java.awt.Label("G1:"));
    colorPanel1.add(g1Field);
    colorPanel1.add(new java.awt.Label("B1:"));
    colorPanel1.add(b1Field);
    
    var colorPanel2 = new java.awt.Panel(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT, 5, 0));
    var r2Field = new java.awt.TextField(String(r2), 8);
    var g2Field = new java.awt.TextField(String(g2), 8);
    var b2Field = new java.awt.TextField(String(b2), 8);
    colorPanel2.add(new java.awt.Label("R2:"));
    colorPanel2.add(r2Field);
    colorPanel2.add(new java.awt.Label("G2:"));
    colorPanel2.add(g2Field);
    colorPanel2.add(new java.awt.Label("B2:"));
    colorPanel2.add(b2Field);
    
    var colorPanel3 = new java.awt.Panel(new java.awt.FlowLayout(java.awt.FlowLayout.LEFT, 5, 0));
    var r3Field = new java.awt.TextField(String(r3), 8);
    var g3Field = new java.awt.TextField(String(g3), 8);
    var b3Field = new java.awt.TextField(String(b3), 8);
    colorPanel3.add(new java.awt.Label("R3:"));
    colorPanel3.add(r3Field);
    colorPanel3.add(new java.awt.Label("G3:"));
    colorPanel3.add(g3Field);
    colorPanel3.add(new java.awt.Label("B3:"));
    colorPanel3.add(b3Field);
    
    c.gridy = 0;
    colorPanel.add(colorPanel1, c);
    c.gridy = 1;
    colorPanel.add(colorPanel2, c);
    c.gridy = 2;
    colorPanel.add(colorPanel3, c);
    
    gd.addPanel(colorPanel);
    
    gd.showDialog();

    if (gd.wasCanceled()) {
        IJ.log("User canceled parameter input.");
        return false;
    }

    // Get checkbox values
    var hasVessels = gd.getNextBoolean();
    var hasBackground = gd.getNextBoolean();
    var fillCorners = gd.getNextBoolean();
    
    // Get paths
    folderPath = gd.getNextString();
    classifierPath = gd.getNextString();
    
    // Get variables
    TISSUE_THRESHOLD = gd.getNextNumber();
    TISSUE_FRAGMENT_MIN_SIZE = gd.getNextNumber();
    VESSEL_MIN_SIZE = gd.getNextNumber();
    VESSEL_MAX_SIZE = gd.getNextNumber();
    maxMemory = gd.getNextNumber();
    nuclearThreshold = gd.getNextNumber();
    minNuclearSize = gd.getNextNumber();
    minNuclearCircularity = gd.getNextNumber();
    
    // Get color deconvolution parameters
    r1 = parseFloat(r1Field.getText());
    g1 = parseFloat(g1Field.getText());
    b1 = parseFloat(b1Field.getText());
    r2 = parseFloat(r2Field.getText());
    g2 = parseFloat(g2Field.getText());
    b2 = parseFloat(b2Field.getText());
    r3 = parseFloat(r3Field.getText());
    g3 = parseFloat(g3Field.getText());
    b3 = parseFloat(b3Field.getText());

    // Validate folder path
    if (!folderPath) {
        IJ.error("No folder selected");
        return false;
    }

    return {
        hasVessels: hasVessels,
        hasBackground: hasBackground,
        fillCorners: fillCorners
    };
}

// Function to choose a folder for analysis
function chooseFolder() {
    IJ.log("Starting folder selection process...");

    // Close all open images
    var titles = WindowManager.getImageTitles();
    for (var i = 0; i < titles.length; i++) {
        WindowManager.getImage(titles[i]).close();
    }
    IJ.log("Closed all open images.");

    // Open a dialog to select the folder
    var dc = new DirectoryChooser("Select the folder containing images");
    var folder_path = dc.getDirectory();

    if (folder_path == null) {
        IJ.log("No folder selected. Exiting script.");
        return null;
    }

    IJ.log("Folder selected: " + folder_path);
    return folder_path;
}

// Function to convert binary image to selection
function binaryToSelection(number, colour, name, image, fillHolesTrue, invertTrue) {
    IJ.log("Converting binary image to selection: " + name);
    if (invertTrue) {
        IJ.run(image, "Invert LUT", "");
    }
    if (fillHolesTrue) {
        IJ.run(image, "Fill Holes", "");
    }
    IJ.run(image, "Create Selection", "");
    rm.addRoi(image.getRoi());
    rm.select(number);
    rm.runCommand("Set Fill Color", colour);
    rm.runCommand("Rename", name);
    rm.runCommand(image, "Deselect");
}

// Function to select particles based on size
function particleSelection(minSize, maxSize, image, name, fill, color, invertTrue) {
    IJ.log("Starting particle selection: " + name);
    if (invertTrue) {
        IJ.run(image, "Invert LUT", "");
    }
    
    var initial_roi_count = rm.getCount();
    IJ.run(image, "Analyze Particles...", "size=" + minSize + "-" + maxSize + " pixel show=[Overlay] clear"); 

    var overlay = image.getOverlay();
    if (overlay != null && overlay.size() > 0) {
        IJ.log("Combining " + overlay.size() + " ROIs");
        var combined_roi = new ShapeRoi(overlay.get(0));
        for (var i = 1; i < overlay.size(); i++) {
            combined_roi.or(new ShapeRoi(overlay.get(i)));
        }
        
        for (var i = rm.getCount() - 1; i >= initial_roi_count; i--) {
            rm.select(i);
            rm.runCommand("Delete");
        }
        
        rm.addRoi(combined_roi);
        rm.select(rm.getCount() - 1);
        rm.runCommand("Rename", name);
        rm.runCommand("Set Fill Color", color);

        if (fill.toLowerCase() === "true") {
            rm.runCommand("Fill");
        }
        IJ.log("Combined ROI added to ROI Manager: " + name);
    } else {
        IJ.log("No particles found or overlay is null");
    }
}

// Function to fill corner of an image
function fillCorner(imp, x, y) {
    IJ.setTool("wand");
    IJ.doWand(x, y);
    IJ.setForegroundColor(255, 255, 255);
    IJ.run(imp, "Fill", "slice");
}

function create_binary_image_from_roi(imp, roi, name) {
    IJ.log("Creating binary image from ROI: " + name);
    var ip = imp.getProcessor().createProcessor(imp.getWidth(), imp.getHeight());
    ip.setColor(0);
    ip.fill();
    
    ip.setColor("#ffffff");
    ip.fill(roi);
    
    var binary_imp = new ImagePlus(name, ip);
    
    IJ.run(binary_imp, "8-bit", "");
    ip.setColor(255);
    
    IJ.setThreshold(binary_imp, 2, 255);
    IJ.run(binary_imp, "Convert to Mask", "");
    
    binary_imp.show();
    IJ.log("Binary image created: " + name);
    return binary_imp;
}

function binary_fill_holes(image) {
    IJ.log("Filling holes in binary image");
    IJ.run(image, "8-bit", "");
    IJ.run(image, "Dilate", "");
    IJ.run(image, "Dilate", "");
    IJ.run(image, "Dilate", "");
    IJ.run(image, "Fill Holes", "");
    IJ.run(image, "Erode", "");
    IJ.run(image, "Erode", "");
    IJ.run(image, "Erode", "");
    IJ.log("Holes filled in binary image");
}

function particleSelection_nuclei(minSize, maxSize, image, name, fill, color, invertTrue) {
    IJ.log("Starting particle selection for nuclei");
    
    // Invert LUT if specified
    if (invertTrue) {
        IJ.run(image, "Invert LUT", "");
        IJ.log("LUT inverted");
    }
    
    var initial_roi_count = rm.getCount();
    
    // Analyze particles and add to ROI Manager
    IJ.run(image, "Analyze Particles...", "size=" + minSize + "-" + maxSize + " pixel show=[Overlay] add");
    IJ.log("Particles analyzed and added to ROI Manager");

    var final_roi_count = rm.getCount();
    
    // Set properties for each new ROI
    for (var i = initial_roi_count; i < final_roi_count; i++) {
        rm.select(i);
        rm.runCommand("Set Fill Color", color);
        rm.runCommand("Rename", name + "_" + (i - initial_roi_count + 1));

        if (fill.toLowerCase() === "true") {
            rm.runCommand("Fill");
        }
    }
    
    rm.runCommand("Show All");
    IJ.log("Particle selection completed. " + (final_roi_count - initial_roi_count) + " particles selected");
    return [initial_roi_count, final_roi_count];
}

function create_background_points(image, spacing) {
    IJ.log("Creating background points for Voronoi cell creation");
    spacing = spacing || 10;
    var width = image.getWidth();
    var height = image.getHeight();
    var background_points = [];
    
    // Create points along the top and bottom edges
    for (var x = 0; x < width; x += spacing) {
        background_points.push([x, 0]);
        background_points.push([x, height - 1]);
    }
    
    // Create points along the left and right edges
    for (var y = spacing; y < height - spacing; y += spacing) {
        background_points.push([0, y]);
        background_points.push([width - 1, y]);
    }
    
    IJ.log("Background points created: " + background_points.length + " points");
    return background_points;
}

// Function to create Voronoi cells based on nuclei positions
function create_voronoi_cells(image, initial_count, final_count) {
    IJ.log("Starting Voronoi cell creation");
    var points_imp = IJ.createImage("Points", "8-bit black", image.getWidth(), image.getHeight(), 1);
    points_imp.show();
    
    var ip = points_imp.getProcessor();
    ip.setColor(255);
    
    // Mark nuclei centers
    for (var i = initial_count; i < final_count; i++) {
        rm.select(i);
        var roi = rm.getRoi(i);
        var bounds = roi.getBounds();
        var x = bounds.x + bounds.width/2;
        var y = bounds.y + bounds.height/2;
        ip.drawDot(Math.round(x), Math.round(y));
    }
    
    // Add background points
    // var background_points = create_background_points(image);
    // for (var j = 0; j < background_points.length; j++) {
    //     ip.drawDot(background_points[j][0], background_points[j][1]);
    // }
    
    points_imp.updateAndDraw();
    
    // Create Voronoi diagram
    IJ.setAutoThreshold(points_imp, "Default dark");
    IJ.run(points_imp, "Convert to Mask", "");
    IJ.run(points_imp, "Voronoi", "");
    IJ.setRawThreshold(points_imp, 1, 255, null);
    IJ.run(points_imp, "Convert to Mask", "");
    
    var imageWidth = image.getWidth();
    var imageHeight = image.getHeight();
    var cellsToKeep = [];
    var nucleiToDelete = [];
    
    // Create cell ROIs from Voronoi diagram and check borders
    for (var i = initial_count; i < final_count; i++) {
        rm.select(i);
        var nucleus_roi = rm.getRoi(i);
        var bounds = nucleus_roi.getBounds();
        var x = bounds.x + bounds.width/2;
        var y = bounds.y + bounds.height/2;
        
        IJ.doWand(Math.round(x), Math.round(y));
        
        var cell_roi = points_imp.getRoi();
        
        if (cell_roi != null) {
            var cellBounds = cell_roi.getBounds();
            // Check if cell touches borders
            if (cellBounds.x > 0 && 
                cellBounds.y > 0 && 
                (cellBounds.x + cellBounds.width) < imageWidth && 
                (cellBounds.y + cellBounds.height) < imageHeight) {
                
                rm.addRoi(cell_roi);
                rm.select(rm.getCount()-1);
                rm.runCommand("Set Fill Color", "magenta");
                rm.runCommand("Rename", "Cell_" + (i-initial_count+1));
                cellsToKeep.push(i-initial_count+1);
            } else {
                nucleiToDelete.push(i);
            }
        }
    }
    // Delete nuclei ROIs that correspond to border-touching cells
    // Sort in descending order to avoid index shifting when deleting
    nucleiToDelete.sort(function(a, b) { return b - a; });
    for (var i = 0; i < nucleiToDelete.length; i++) {
        rm.select(nucleiToDelete[i]);
        rm.runCommand("Delete");
    }
    
    IJ.log("Voronoi cell creation completed. Deleted " + nucleiToDelete.length + " border-touching nuclei");
}


function separate_cytoplasm() {
    IJ.log("Starting cytoplasm separation");
    
    // Get tissue ROI (assumed to be at index 2)
    var tissue_roi = rm.getRoi(2);
    var vessels_roi = rm.getRoi(4);
    var tissue_shape = new ShapeRoi(tissue_roi);
    var vessels_shape = new ShapeRoi(vessels_roi);
    
    // Get the maximum ROI number by checking the last ROI name
    var lastRoiIndex = rm.getCount() - 1;
    var lastRoiName = rm.getName(lastRoiIndex);
    var maxNumber = 0;
    
    // Find all nucleus ROIs and their numbers
    var nucleusIndices = {};
    var cellIndices = {};
    
    // Scan through all ROIs to map nucleus and cell indices
    for (var i = 0; i < rm.getCount(); i++) {
        var name = rm.getName(i);
        if (name.startsWith("Nucleus_")) {
            var num = parseInt(name.split("_")[1]);
            nucleusIndices[num] = i;
            if (num > maxNumber) maxNumber = num;
        } else if (name.startsWith("Cell_")) {
            var num = parseInt(name.split("_")[1]);
            cellIndices[num] = i;
            if (num > maxNumber) maxNumber = num;
        }
    }
    
    var processedCount = 0;
    
    // Process each pair of nucleus and cell
    for (var num = 1; num <= maxNumber; num++) {
        // Check if both nucleus and cell exist for this number
        if (nucleusIndices[num] !== undefined && cellIndices[num] !== undefined) {
            // Get nucleus and cell ROIs
            rm.select(nucleusIndices[num]);
            var nucleus_roi = new ShapeRoi(rm.getRoi(nucleusIndices[num]));
            
            rm.select(cellIndices[num]);
            var cell_roi = new ShapeRoi(rm.getRoi(cellIndices[num]));
            
            // Create cytoplasm by intersecting cell with tissue and subtracting nucleus
            var tissue_cleaned = tissue_shape.not(vessels_shape)
            var cell_in_tissue = cell_roi.and(tissue_cleaned);
            var cytoplasm_roi = cell_in_tissue.not(nucleus_roi);
            
            // Add cytoplasm ROI
            rm.addRoi(cytoplasm_roi);
            rm.select(rm.getCount() - 1);
            rm.runCommand("Set Fill Color", "cyan");
            rm.runCommand("Rename", "Cytoplasm_" + num);
            
            processedCount++;
        }
    }
    
    IJ.log("Cytoplasm separation completed. Created " + processedCount + " cytoplasm ROIs");
}

// Rest of the code remains unchanged...

        
    function saveData(title, nuclei) {
        // Get the Hematoxylin and Eosin images
        var hematoxylinImp = WindowManager.getImage("Image-(Colour_1)");
        var eosinImp = WindowManager.getImage("Image-(Colour_2)");
        
        // Get the original image
        var originalImp = IJ.getImage();
        var originalImageName = originalImp.getTitle();
    
        // Get the ROI Manager
        var rm = RoiManager.getInstance();
        if (rm == null || rm.getCount() == 0) {
            IJ.error("No ROIs in ROI Manager");
            return;
        }
    
        // Create a new ResultsTable
        var rt = new ResultsTable();
        IJ.run(nuclei, "Set Scale...", "distance=1 known=0.29 unit=um");
        
        // Set up ALL measurements
        var measurements = Measurements.AREA + Measurements.MEAN + Measurements.STD_DEV + 
                          Measurements.MODE + Measurements.MIN_MAX + Measurements.CENTROID + 
                          Measurements.CENTER_OF_MASS + Measurements.PERIMETER + 
                          Measurements.RECT + Measurements.ELLIPSE + 
                          Measurements.SHAPE_DESCRIPTORS + Measurements.FERET + 
                          Measurements.INTEGRATED_DENSITY + Measurements.MEDIAN + 
                          Measurements.SKEWNESS + Measurements.KURTOSIS + 
                          Measurements.AREA_FRACTION;
    
        // Get all ROIs from the ROI Manager
        var rois = rm.getRoisAsArray();
    
        // Iterate through each ROI
        for (var i = 0; i < rois.length; i++) {
            var roi = rois[i];
            var roiName = rm.getName(i);
    
            // Measure Hematoxylin
            hematoxylinImp.setRoi(roi);
            var hematoxylinIp = hematoxylinImp.getProcessor().crop();
            var hematoxylinHistogram = hematoxylinIp.getHistogram();
            var hematoxylinHistogramString = Java.from(hematoxylinHistogram).join(",");
    
            // Measure Eosin
            eosinImp.setRoi(roi);
            var eosinIp = eosinImp.getProcessor().crop();
            var eosinHistogram = eosinIp.getHistogram();
            var eosinHistogramString = Java.from(eosinHistogram).join(",");
    
            // Perform measurements on the original image
            originalImp.setRoi(roi);
            var stats = ImageStatistics.getStatistics(originalImp.getProcessor(), measurements, originalImp.getCalibration());
    
            // Add measurements to the ResultsTable
            rt.incrementCounter();
            addValue(rt, "ROI", roiName);
            addValue(rt, "Area", stats.area);
            addValue(rt, "Mean", stats.mean);
            addValue(rt, "StdDev", stats.stdDev);
            addValue(rt, "Mode", stats.mode);
            addValue(rt, "Min", stats.min);
            addValue(rt, "Max", stats.max);
            addValue(rt, "X", stats.xCentroid);
            addValue(rt, "Y", stats.yCentroid);
            addValue(rt, "XM", stats.xCenterOfMass);
            addValue(rt, "YM", stats.yCenterOfMass);
            addValue(rt, "Perimeter", stats.perimeter);
            addValue(rt, "BX", stats.roiX);
            addValue(rt, "BY", stats.roiY);
            addValue(rt, "Width", stats.roiWidth);
            addValue(rt, "Height", stats.roiHeight);
            addValue(rt, "Major", stats.major);
            addValue(rt, "Minor", stats.minor);
            addValue(rt, "Angle", stats.angle);
            addValue(rt, "Circ.", stats.circularity);
            addValue(rt, "Feret", stats.feret);
            addValue(rt, "IntDen", stats.area * stats.mean);
            addValue(rt, "Median", stats.median);
            addValue(rt, "Skewness", stats.skewness);
            addValue(rt, "Kurtosis", stats.kurtosis);
            addValue(rt, "AreaFraction", stats.areaFraction);
            addValue(rt, "Hematoxylin_Histogram", hematoxylinHistogramString);
            addValue(rt, "Eosin_Histogram", eosinHistogramString);
        }
    
        // Update and show the results table
        rt.show("Measurements and Histograms for ROIs");
    
        // Save the results table as CSV
        var csvFileName = title + "_results.csv";
        saveResultsAsCSV(rt, csvFileName);
    
        IJ.log("Measurements and histograms for all ROIs have been created and displayed in the table.");
        IJ.log("Results have been saved as: " + csvFileName);
    }
    
    // Helper function to safely add values to the ResultsTable
    function addValue(rt, column, value) {
        if (value === undefined || value === null) {
            rt.addValue(column, "");
        } else if (typeof value === 'number' && isNaN(value)) {
            rt.addValue(column, "");
        } else {
            rt.addValue(column, value);
        }
    }
    
    // Function to save ResultsTable as CSV
    function saveResultsAsCSV(rt, fileName) {
        var file = new File(IJ.getDirectory("current"), fileName);
        rt.saveAs(file.getAbsolutePath());
    }
    
    
    //###################### MAIN FUNCTIONS ###############################
    
    // Main function
    function fileProcessing(imp, options) {
        var title = imp.getTitle();
        IJ.log("Starting tissue selection process of " + title);
        
        imp.setTitle("Original");
        imp.show();
       
        // Clear ROI Manager if it was opened
        rm = RoiManager.getInstance();
        if (rm != null) {
            rm.reset();
        } else {
            rm = new RoiManager();
        }
    
        if (options.fillCorners) {
            var width = imp.getWidth();
            var height = imp.getHeight();
    
            // Fill corners of the image
            fillCorner(imp, 0, 0);
            fillCorner(imp, width - 1, 0);
            fillCorner(imp, 0, height - 1);
            fillCorner(imp, width - 1, height - 1);
        }
    
        
    
        if (options.hasBackground) {
    
            // Duplicate image for processing
            var duplicate = imp.duplicate();
            duplicate.setTitle("Copy");
            duplicate.show();
    
            // Pre-process the duplicated image
            IJ.log("Pre-processing the duplicated image");
            ImagePlus.setDefault16bitRange(16);
            duplicate.updateAndDraw();
            IJ.run(duplicate, "Despeckle", "");
            IJ.run(duplicate, "8-bit", "");
            IJ.setAutoThreshold(duplicate, "Default no-reset");
            IJ.setRawThreshold(duplicate, 0, TISSUE_THRESHOLD, null);
            IJ.run(duplicate, "Convert to Mask", "");
    
            // Create selections for background and tissue
            binaryToSelection(0, "white", "All background", duplicate, false, true);
            binaryToSelection(1, "white", "Tissue", duplicate, false, true);
            rm.select(rm.getCount() - 1);
    
            // Select background particles
            particleSelection(0, "Infinity", duplicate, "Tissue Cleaned", "false", "magenta", false);
            rm.select(rm.getCount() - 1);
            IJ.run(duplicate, "Create Selection", "");
            IJ.run(duplicate, "Make Inverse", "");
            rm.addRoi(duplicate.getRoi());
           
            rm.select(rm.getCount() - 1);
            rm.runCommand("Rename", "Background");
    
            // Fill the background with white in the original image
            rm.select(rm.getCount() - 1);
            imp.setRoi(rm.getRoi(rm.getCount() - 1));
            IJ.setForegroundColor(255, 255, 255);
            IJ.setBackgroundColor(255, 255, 255);
            IJ.run(imp, "Fill", "slice");
            imp.killRoi();
    
            IJ.log("Background filled with white in the original image");
}
if (options.hasVessels) {
    // Create selection for vessels
    IJ.log("Creating selection for vessels");
    
    // Duplicate for vessel detection
    var vesselImp = imp.duplicate();
    vesselImp.setTitle("Vessels");
    vesselImp.show();
    
    // Convert to 8-bit and enhance contrast
    IJ.run(vesselImp, "8-bit", "");

    // Threshold for white vessels
    IJ.setRawThreshold(vesselImp, TISSUE_THRESHOLD, 255);
    IJ.run(vesselImp, "Convert to Mask", "");
    
    // Invert to make vessels black
    IJ.run(vesselImp, "Invert", "");
    
    // Clean up noise and enhance vessels
    IJ.run(vesselImp, "Despeckle", "");
    IJ.run(vesselImp, "Dilate", "");
    IJ.run(vesselImp, "Erode", "");

    IJ.run(vesselImp, "Invert", "");

    // Store initial ROI count before adding vessel ROIs
    var initialVesselRoiCount = rm.getCount();

    // Analyze particles to find vessels
    IJ.run(vesselImp, "Analyze Particles...", "size="+VESSEL_MIN_SIZE+"-"+VESSEL_MAX_SIZE+" circularity=0.00-1.00 pixel show=Masks exclude add");
    
    // Get the number of vessel ROIs added
    var finalVesselRoiCount = rm.getCount();

    // Only proceed if vessels were found
    if (finalVesselRoiCount > initialVesselRoiCount) {
        // Get the first vessel ROI
        rm.select(initialVesselRoiCount);
        var combinedVesselRoi = new ShapeRoi(rm.getRoi(initialVesselRoiCount));
        
        // Combine all vessel ROIs
        for (var i = initialVesselRoiCount + 1; i < finalVesselRoiCount; i++) {
            rm.select(i);
            combinedVesselRoi = combinedVesselRoi.or(new ShapeRoi(rm.getRoi(i)));
        }
        
        // Remove individual vessel ROIs
        for (var i = finalVesselRoiCount - 1; i >= initialVesselRoiCount; i--) {
            rm.select(i);
            rm.runCommand("Delete");
        }
        
        // Add combined vessel ROI
        rm.addRoi(combinedVesselRoi);
        rm.select(rm.getCount() - 1);
        rm.runCommand("Rename", "Vessels");
        rm.runCommand("Set Fill Color", "red");
        
        IJ.log("Combined " + (finalVesselRoiCount - initialVesselRoiCount) + " vessel ROIs");
    } else {
        IJ.log("No vessels found matching the size criteria");
    }
}

var image = imp
if (image == null) {
    IJ.error("No image open");
}

image.setTitle("Image");    

// Color deconvolution
try {
// Perform color deconvolution with global variables
IJ.run(image, "Colour Deconvolution", "vectors=[User values] " +
    "[r1]=" + r1 + " [g1]=" + g1 + " [b1]=" + b1 + " " +
    "[r2]=" + r2 + " [g2]=" + g2 + " [b2]=" + b2 + " " +
    "[r3]=" + r3 + " [g3]=" + g3 + " [b3]=" + b3);
// Get the color-1 image
var color1Imp = WindowManager.getImage("Image-(Colour_1)")
var color2Imp = WindowManager.getImage("Image-(Colour_2)")
var color3Imp = WindowManager.getImage("Image-(Colour_3)")
var deconvolution = WindowManager.getImage("Colour Deconvolution")

//  color2Imp.changes = false;
//  color2Imp.close();

color3Imp.changes = false;
color3Imp.close();

deconvolution.changes = false;
deconvolution.close();

// Use color1Imp for further processing
image = color1Imp;
} catch (e) {
IJ.error("Color Deconvolution Error", "Failed to perform color deconvolution: " + e);
IJ.log("Error details: " + e);
throw e;
}

// Weka segmentation initialization
try {
// Variables for Weka Tiling using global maxMemory
var getProbs = true;
var xTiles = Math.ceil(image.getWidth() / maxMemory);
var yTiles = Math.ceil(image.getHeight() / maxMemory);
var zTiles = 0;

// Create Weka segmentation object with the image
var segmentator = new WekaSegmentation(image);
if (segmentator == null) {
    throw "Failed to create WekaSegmentation object";
}

// Load the classifier using global path
if (!segmentator.loadClassifier(classifierPath)) {
    throw "Failed to load classifier from " + classifierPath;
}
} catch (e) {
IJ.error("Segmentation Initialization Error", "Failed to initialize Weka segmentation: " + e);
IJ.log("Error details: " + e);
throw e;
}
try {
    // Set up tiles array
    var tilesPerDim = [];
    if (image.getNSlices() > 1) {
        tilesPerDim = java.lang.reflect.Array.newInstance(java.lang.Integer.TYPE, 3);
        tilesPerDim[2] = zTiles;
    } else {
        tilesPerDim = java.lang.reflect.Array.newInstance(java.lang.Integer.TYPE, 2);
    }
    tilesPerDim[0] = xTiles;
    tilesPerDim[1] = yTiles;

    var result = segmentator.applyClassifier(image, tilesPerDim, 0, true);
    if (result == null) {
        throw "Failed to generate probability maps";
    }

        // Set proper display range and LUT for probabilities
        var stack = result.getStack();
        var numClasses = stack.getSize();
        
        // Create different LUTs for each class probability
        var colors = [
            [0, 0, 255],    // Blue
            [255, 0, 0],    // Red
            [0, 255, 0],    // Green
            [255, 255, 0],  // Yellow
            [255, 0, 255],  // Magenta
            [0, 255, 255]   // Cyan
        ];
        
        for (var i = 1; i <= numClasses; i++) {
            var ip = stack.getProcessor(i);
            ip.setMinAndMax(0, 1);
            
            // Create custom LUT for this probability map
            if (i <= colors.length) {
                var r = new Array(256);
                var g = new Array(256);
                var b = new Array(256);
                
                for (var j = 0; j < 256; j++) {
                    var intensity = j / 255.0;
                    r[j] = Math.round(colors[i-1][0] * intensity);
                    g[j] = Math.round(colors[i-1][1] * intensity);
                    b[j] = Math.round(colors[i-1][2] * intensity);
                }
                
                var lut = new LUT(r, g, b);
                ip.setLut(lut);
            }
        }
        result.setTitle("Probability maps of " + image.getTitle());
    } catch (e) {
        IJ.error("Probability Map Generation Error", "Failed to generate or process probability maps: " + e);
        IJ.log("Error details: " + e);
        throw e;
    }

    // Image processing and Nuclei segmentation
    try {
        // Show result
        result.show();
        IJ.run("Stack to Images", "");

        var nuclei = WindowManager.getImage("nuclei")
        var cytoplasm = WindowManager.getImage("cytoplasm")
        var white = WindowManager.getImage("white")

        cytoplasm.changes = false;
        cytoplasm.close();

        white.changes = false;
        white.close();

        IJ.run(nuclei, "8-bit", "");
        IJ.setRawThreshold(nuclei, nuclearThreshold, 255, null);
        IJ.run(nuclei, "Convert to Mask", "");
        IJ.run(nuclei, "Fill Holes", "");
        IJ.run(nuclei, "Watershed", "");

        IJ.run(nuclei, "Analyze Particles...", "size=" + minNuclearSize + "-Infinity circularity=" + 
              minNuclearCircularity + "-1.00 pixel show=[Overlay]");

        var result = particleSelection_nuclei(0, 100000, nuclei, "Nucleus", "false", "black", false);
        var initial_count = result[0];
        var final_count = result[1];

        create_voronoi_cells(nuclei, initial_count, final_count);

        // Separate cytoplasm from nuclei
        separate_cytoplasm();

        // Pass nuclei to saveData
        saveData(title, nuclei);
        
    } catch (e) {
        IJ.error("Image Processing Error", "Failed during image processing or nuclear segmentation: " + e);
        IJ.log("Error details: " + e);
        throw e;
    }

      var close_Original = WindowManager.getImage("Image")
      close_Original.changes = false;
      close_Original.close();
  
      var close_img1 = WindowManager.getImage("Image-(Colour_1)")
      close_img1.changes = false;
      close_img1.close();
  
      var close_nuclei = WindowManager.getImage("nuclei")
      close_nuclei.changes = false;
      close_nuclei.close();
  
      var close_points = WindowManager.getImage("Points")
      close_points.changes = false;
      close_points.close();
  
      // Calculate and show elapsed time
      var estimatedTime = java.lang.System.currentTimeMillis() - startTime;
      IJ.log("** Finished processing in " + estimatedTime /1000 + " s **");
    }
  

// Main Loop
function main() {
    IJ.log("Starting liver processing...");
    
    // Get user input for parameters once
    var options = getUserInput();
    if (!options) {
        IJ.log("User canceled the operation. Exiting script.");
        return;
    }
    
    // Create output folder
    var output_folder = new File(folderPath, "processed_images");
    if (!output_folder.exists()) {
        output_folder.mkdir();
    }
    
    // Process all images in the folder
    var folder = new File(folderPath);
    var files = folder.listFiles();
    
    // MAIN LOOP THAT GOES THROUGH EACH FILE
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.isFile() && (file.getName().endsWith(".tif") || file.getName().endsWith(".jpg") || file.getName().endsWith(".png"))) {
            IJ.log("Processing file: " + file.getName());
            
            // Open the image
            var imp = IJ.openImage(file.getAbsolutePath());
            if (imp == null) {
                IJ.log("Failed to open image: " + file.getName());
                continue;
            }

            // Clear ROI Manager
            rm = RoiManager.getInstance();
            if (rm != null) {
                rm.reset();
            } else {
                rm = new RoiManager();
            }
            
            // Pass options to fileProcessing
            fileProcessing(imp, options);
        }
    }
    
    IJ.log("Liver processing completed for all images in the folder.");
}
  main();

  IJ.log("liverProcessing.js execution completed.");  

    