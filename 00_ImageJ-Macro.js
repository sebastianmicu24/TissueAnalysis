// ✓ Aggiungi roundness ai vasi 
// ✓ Separa dimensione nucleare da quella dei vasi
// ✓ cambia i colori dei ROI
// ✓ migliora monitoraggio del progresso
// ✓ make more robust batch file analysis to not have bugs
// ✓ Migliora classifier
// ✓ chiedi a cline di rimuovere qualsiasi ripetizione di codice
// ✓ controlla qualità del csv esportato
// ✓ risolvi il bug che rende la finestra del progresso impossibile da chiudere
// ✓ fai test senza bordervessels
// ✓ aggiungi user input
// ✓ risolvi il bug che rende la finestra del progresso impossibile da chiudere
// Migliora la funzionalità in caso di ignorevessels true
// Risolvi preview in caso di assenza di border vessels
// Migliora classifier per casi limite e aggregati linfocitari
// risolvi il bug che mostra il progresso errato in caso di sottocartelle

// Import required Java classes
importClass(Packages.ij.IJ);
importClass(Packages.ij.ImagePlus);
importClass(Packages.ij.WindowManager);
importClass(Packages.java.io.File);
importClass(Packages.trainableSegmentation.WekaSegmentation);
importClass(Packages.ij.plugin.ImageCalculator);
importClass(Packages.ij.plugin.frame.RoiManager);
importClass(Packages.ij.gui.NonBlockingGenericDialog);
importClass(Packages.ij.gui.ShapeRoi);
importClass(Packages.ij.io.FileSaver);
importClass(Packages.ij.measure.ResultsTable);
importClass(Packages.ij.measure.Measurements);
importClass(Packages.ij.process.ImageStatistics);
importClass(Packages.fiji.util.gui.GenericDialogPlus);

// Configuration parameters
var nucleiThreshold = 110;
var whiteThreshold = 150;
var maxMemory = 1024;
var classifierPath = "C:/Users/sebas/Desktop/Microscopy/98 Data ML/Colour4.model";
var folderPath = "C:/Users/sebas/Desktop/Microscopy/03 Stitched/a";
var outputBasePath = "C:/Users/sebas/Desktop/Microscopy/04 Analysis";
var ignoreBorderVessels = true;
var minSizeVessels = 80;
var maxSizeVessels = "Infinity"
var minSizeNuclei = 5;
var maxSizeNuclei = "Infinity";
var nucleiRoundness = 0;

// Global flag to control execution
var shouldStop = false;

// Progress monitoring
var progressDialog = {
    dialog: null,
    textArea: null,
    startTime: null,
    fileStartTime: null,
    
    initialize: function() {
        if (!this.dialog) {
            this.dialog = new java.awt.Frame("Analysis Progress");
            this.dialog.setSize(600, 400);
            
            // Create layout
            var panel = new java.awt.Panel(new java.awt.BorderLayout());
            
            // Add text area
            this.textArea = new java.awt.TextArea("", 0, 0, java.awt.TextArea.SCROLLBARS_VERTICAL_ONLY);
            this.textArea.setEditable(false);
            panel.add(this.textArea, java.awt.BorderLayout.CENTER);
            
            // Add stop button
            var buttonPanel = new java.awt.Panel();
            var stopButton = new java.awt.Button("Stop Analysis");
            stopButton.addActionListener(new java.awt.event.ActionListener({
                actionPerformed: function(e) {
                    shouldStop = true;
                    progressDialog.showStatus("\nStopping analysis...");
                }
            }));
            buttonPanel.add(stopButton);
            panel.add(buttonPanel, java.awt.BorderLayout.SOUTH);
            
            this.dialog.add(panel);
            
            // Add window closing listener
            this.dialog.addWindowListener(new java.awt.event.WindowAdapter({
                windowClosing: function(e) {
                    shouldStop = true;
                    progressDialog.close();
                }
            }));
            
            // Center on screen
            var screen = java.awt.Toolkit.getDefaultToolkit().getScreenSize();
            var x = (screen.width - 600) / 2;
            var y = (screen.height - 400) / 2;
            this.dialog.setLocation(x, y);
            
            // Show dialog
            this.dialog.setVisible(true);
            
            // Initialize start time
            this.startTime = new Date().getTime();
        }
    },

    formatTime: function(milliseconds) {
        var seconds = Math.floor(milliseconds / 1000);
        var hours = Math.floor(seconds / 3600);
        seconds %= 3600;
        var minutes = Math.floor(seconds / 60);
        seconds %= 60;
        // Fix padStart issue by using custom padding
        function pad(num) {
            return (num < 10 ? '0' : '') + num;}
        
        return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    },

    showProgress: function(message, current, total) {
        if (!this.dialog) this.initialize();
        var percent = Math.round((current / total) * 100);
        var bar = this.getProgressBar(percent);
        
        var currentTime = new Date().getTime();
        var elapsed = this.formatTime(currentTime - this.startTime);
        var fileElapsed = this.formatTime(currentTime - this.fileStartTime);
        
        this.appendText(message + "\n" + bar + "\n");
        this.appendText("Time elapsed - Total: " + elapsed + " | Current file: " + fileElapsed + "\n");
    },
    
    showStatus: function(message) {
        if (!this.dialog) this.initialize();
        this.appendText(message + "\n");
    },
    
    startFileTimer: function() {
        this.fileStartTime = new Date().getTime();
    },
    
    appendText: function(text) {
        if (this.textArea) {
            this.textArea.append(text);
            // Scroll to bottom
            this.textArea.setCaretPosition(this.textArea.getText().length());
        }
    },
    
    getProgressBar: function(percent) {
        var barLength = 40;
        var filledLength = Math.round((percent * barLength) / 100);
        var bar = "";
        for (var i = 0; i < filledLength; i++) bar += "#";
        for (var i = filledLength; i < barLength; i++) bar += "-";
        return "[" + bar + "] " + percent + "%";
    },
    
    close: function() {
        if (this.dialog) {
            this.dialog.dispose();
            this.dialog = null;
            this.textArea = null;
        }
    }
};

// File handling functions
function isImageFile(file) {
    if (!file.isFile()) return false;
    var name = file.getName().toLowerCase();
    if (name.indexOf("results") !== -1) return false;
    return name.endsWith(".tif") || 
           name.endsWith(".tiff") || 
           name.endsWith(".jpg") || 
           name.endsWith(".jpeg") || 
           name.endsWith(".png") || 
           name.endsWith(".gif");
}

function getRelativePath(file, basePath) {
    var filePath = file.getAbsolutePath();
    return filePath.substring(basePath.length);
}

function createOutputDirectory(file, basePath) {
    var relativePath = getRelativePath(file.getParentFile(), basePath);
    var outputDir = new File(outputBasePath + relativePath);
    if (!outputDir.exists()) {
        outputDir.mkdirs();
    }
    return outputDir;
}

function createFullCanvas(width, height) {
    var imp = IJ.createImage("Full Canvas", "8-bit black", width, height, 1);
    IJ.run(imp, "Invert", "");
    return imp;
}


function countImagesInDirectory(dir) {
    var count = 0;
    var files = dir.listFiles();
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.isDirectory() && file.getName().toLowerCase().indexOf("results") === -1) {
            count += countImagesInDirectory(file);
        } else if (isImageFile(file)) {
            count++;
        }
    }
    return count;
}

function getUserInput() {
    var gd = new GenericDialogPlus("Analysis Parameters");
    
    // Add paths
    gd.addDirectoryField("Input Folder:", folderPath);
    gd.addDirectoryField("Output Base Path:", outputBasePath);
    gd.addFileField("Classifier Path:", classifierPath);
    
    // Add numeric parameters
    gd.addNumericField("Nuclei Threshold (0-255):", nucleiThreshold, 0);
    gd.addNumericField("White Threshold (0-255):", whiteThreshold, 0);
    gd.addNumericField("Max Memory (tile size):", maxMemory, 0);
    
    // Add size parameters
    gd.addNumericField("Min Size Vessels (px²):", minSizeVessels, 0);
    gd.addStringField("Max Size Vessels:", maxSizeVessels);
    gd.addNumericField("Min Size Nuclei (px²):", minSizeNuclei, 0);
    gd.addStringField("Max Size Nuclei:", maxSizeNuclei);
    
    // Add other parameters
    gd.addNumericField("Nuclei Roundness (0.00-1.00):", nucleiRoundness, 2);
    gd.addCheckbox("Ignore Border Vessels", ignoreBorderVessels);
    
    gd.showDialog();
    
    if (gd.wasCanceled()) {
        return false;
    }
    
    // Get the values
    folderPath = gd.getNextString();
    outputBasePath = gd.getNextString();
    classifierPath = gd.getNextString();
    
    nucleiThreshold = gd.getNextNumber();
    whiteThreshold = gd.getNextNumber();
    maxMemory = gd.getNextNumber();
    
    minSizeVessels = gd.getNextNumber();
    maxSizeVessels = gd.getNextString();
    minSizeNuclei = gd.getNextNumber();
    maxSizeNuclei = gd.getNextString();
    
    nucleiRoundness = gd.getNextNumber();
    ignoreBorderVessels = gd.getNextBoolean();
    
    return true;
}

// Main processing functions
function processFile(file, basePath) {
    if (shouldStop) return false;
    
    try {
        progressDialog.startFileTimer();
        progressDialog.showStatus("Processing file: " + file.getName());
        
        var image = IJ.openImage(file.getAbsolutePath());
        if (!image) {
            progressDialog.showStatus("Failed to open image: " + file.getName());
            return false;
        }
        
        progressDialog.showStatus("Setting image scale...");
        image.removeScale();
        IJ.run(image, "Set Scale...", "distance=1 known=0.29 unit=um global");
        
        if (shouldStop) return false;
        
        progressDialog.showStatus("Initializing WEKA segmentation...");
        var wekaInit = wekaInitialization(image);
        if (!wekaInit) return false;
        
        if (shouldStop) return false;
        
        progressDialog.showStatus("Performing WEKA analysis...");
        var wekaStack = wekaTileAnalysis(image, wekaInit);
        if (!wekaStack) return false;
        
        if (shouldStop) return false;
        
        progressDialog.showStatus("Processing tissue components...");
        var processedImages = processTissue(image, wekaStack);
        if (!processedImages) return false;
        
        if (shouldStop) return false;
        
        progressDialog.showStatus("Analyzing cellular components...");
        var cellularResults = cellularParts(processedImages.vessels, processedImages.nuclei, processedImages.borderVessels, processedImages.allCytoplasmROI);
        if (!cellularResults) return false;
        
        if (shouldStop) return false;
        
        progressDialog.showStatus("Performing colour deconvolution...");
        if (ColourDeconvolution(image)) {
            progressDialog.showStatus("Saving results...");
            var outputDir = createOutputDirectory(file, basePath);
            saveAll(image, wekaStack, outputDir);
            
            var currentTime = new Date().getTime();
            var fileElapsed = progressDialog.formatTime(currentTime - progressDialog.fileStartTime);
            progressDialog.showStatus("Analysis completed for " + file.getName() + " in " + fileElapsed + "\n");
            return true;
        } else {
            IJ.error("Failed to perform colour deconvolution");
            return false;
        }
    } catch (e) {
        progressDialog.showStatus("Error processing " + file.getName() + ": " + e);
        return false;
    }
}

function processDirectory(dir, basePath) {
    if (shouldStop) return;
    
    var files = dir.listFiles();
    var imageCount = 0;
    var subdirs = [];
    
    // First count images recursively
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.isDirectory() && file.getName().toLowerCase().indexOf("results") === -1) {
            subdirs.push(file);
            imageCount += countImagesInDirectory(file);
        } else if (isImageFile(file)) {
            imageCount++;
        }
    }
    
    progressDialog.showStatus("Found " + imageCount + " images to process in " + dir.getName() + "\n");
    
    var processed = 0;
    // First process files in current directory
    for (var i = 0; i < files.length; i++) {
        if (shouldStop) break;
        
        var file = files[i];
        if (isImageFile(file)) {
            if (processFile(file, basePath)) {
                processed++;
                progressDialog.showProgress("Progress in " + dir.getName(), processed, imageCount);
            }
        }
    }
    
    // Then process subdirectories
    for (var i = 0; i < subdirs.length; i++) {
        if (shouldStop) break;
        processDirectory(subdirs[i], basePath);
    }
}


// Image processing functions
function wekaInitialization(image) {
    progressDialog.showStatus("Initializing Segmentation...");
    IJ.log("Initializing Segmentation");
    try {
        var xTiles = Math.ceil(image.getWidth() / maxMemory);
        var yTiles = Math.ceil(image.getHeight() / maxMemory);
        var zTiles = 0;
        
        var segmentator = new WekaSegmentation(image);
        if (!segmentator.loadClassifier(classifierPath)) {
            throw "Failed to load classifier";
        }

        return {
            segmentator: segmentator,
            xTiles: xTiles,
            yTiles: yTiles,
            zTiles: zTiles
        };
    } catch (e) {
        IJ.log("Error in Weka initialization: " + e);
        return null;
    }
}

function wekaTileAnalysis(image, wekaInit) {
    try {
        var tilesPerDim = [];
        if (image.getNSlices() > 1) {
            tilesPerDim = java.lang.reflect.Array.newInstance(java.lang.Integer.TYPE, 3);
            tilesPerDim[2] = wekaInit.zTiles;
        } else {
            tilesPerDim = java.lang.reflect.Array.newInstance(java.lang.Integer.TYPE, 2);
        }
        tilesPerDim[0] = wekaInit.xTiles;
        tilesPerDim[1] = wekaInit.yTiles;
    
        var result = wekaInit.segmentator.applyClassifier(image, tilesPerDim, 0, true);
        return result.getStack();
    } catch (e) {
        IJ.log("Error in Weka analysis: " + e);
        return null;
    }
}

// Binary processing functions
function thresholding(image, min, max) {
    try {
        var imp = image.duplicate();
        IJ.run(imp, "8-bit", "");
        IJ.setThreshold(imp, min, max);
        IJ.run(imp, "Convert to Mask", "");
    return imp;
} catch (e) {
        IJ.log("Error in thresholding: " + e);
        return null;
    }
}

function binaryProcessing(image) {
    try {
        var imp = image.duplicate();
        IJ.run(imp, "8-bit", "");
        return imp;
    } catch (e) {
        IJ.log("Error in binary processing: " + e);
        return null;
    }
}

function binaryProcessingNuclei(image) {
    try {
        var imp = image.duplicate();
        IJ.run(imp, "8-bit", "");
        IJ.run(imp, "Dilate", "");
        IJ.run(imp, "Close", "");
        IJ.run(imp, "Fill Holes", "");
        IJ.run(imp, "Watershed", "");
        IJ.run(imp, "Erode", "");
        return imp;
    } catch (e) {
        IJ.log("Error in binary processing: " + e);
        return null;
    }
}
function particleAnalysis(image, min, max, exclude) {
    try {
        var imp = image.duplicate();
        var command = exclude ? 
            "size="+min+"-"+max+" show=Masks exclude add" :
            "size="+min+"-"+max+" show=Masks add";
        
        IJ.run(imp, "Analyze Particles...", command);
        var maskTitle = "Mask of " + imp.getTitle();
        var mask = WindowManager.getImage(maskTitle);
        return mask;
    } catch (e) {
        IJ.log("Error in particle analysis: " + e);
        return null;
    }
}

// ROI handling functions
function binaryToROI(image, name, color, inverted) {
    try {
        var rm = RoiManager.getInstance();
        if (!rm) rm = new RoiManager();
        
        IJ.run(image, "8-bit", "");
        IJ.run(image, "Make Binary", "");
        IJ.run(image, "Create Selection", "");
        if (inverted) {
            IJ.run(image, "Make Inverse", "");
        }

        var roi = image.getRoi();
        if (roi) {
            rm.addRoi(roi);
            var roiIndex = rm.getCount() - 1;
            rm.select(roiIndex);
            rm.runCommand("Set Fill Color", color);
            rm.runCommand("Rename", name);
            return true;
        }
        return false;
    } catch (e) {
        IJ.log("Error creating ROI: " + e);
        return false;
    }
}

function analyzeAndRenameParticles(image, minSize, maxSize, prefix, color) {
    var rm = RoiManager.getInstance();
    var initialCount = rm.getCount();
    IJ.run(image, "Analyze Particles...", "size=" + minSize + "-" + maxSize + " pixel show=Nothing add");
    var finalCount = rm.getCount();
    
    for (var i = 0; i < finalCount - initialCount; i++) {
        var index = initialCount + i;
        rm.select(index);
        rm.runCommand("Set Fill Color", color);
        rm.runCommand("Rename", prefix + "_" + (i + 1));
    }
    
    return [initialCount, finalCount];
}

// Tissue processing functions
function processTissue(image, stack) {
    try {
        // Process nuclei
        var nucleiProb = new ImagePlus("Nuclei probability", stack.getProcessor(1));
        var nuclei = thresholding(nucleiProb, nucleiThreshold, 255);
        if (!nuclei) return null;
        nuclei = binaryProcessingNuclei(nuclei);
        if (!nuclei) return null;
        nuclei.setTitle("Nuclei binary - " + image.getTitle());
        
        // Process vessels
        var whiteProb = new ImagePlus("White probability", stack.getProcessor(3));
        var white = thresholding(whiteProb, whiteThreshold, 255);
        if (!white) return null;
        white = binaryProcessing(white);
        if (!white) return null;
        
        var vessels, borderVessels;
        if (ignoreBorderVessels) {
            vessels = particleAnalysis(white, minSizeVessels, maxSizeVessels, true);
            if (!vessels) return null;
            vessels.setTitle("Vessels - " + image.getTitle());
            
            var vessels2 = particleAnalysis(white, minSizeVessels, maxSizeVessels, false);
            var ic = new ImageCalculator();
            borderVessels = ic.run("Subtract create", vessels2, vessels);
            borderVessels.setTitle("Border - " + image.getTitle());
            vessels2.close();
            vessels.hide();
        } else {
            vessels = particleAnalysis(white, minSizeVessels, maxSizeVessels, false);
            if (!vessels) return null;
            vessels.setTitle("Vessels binary - " + image.getTitle());
            borderVessels = null;
        }

        // Process cytoplasm
        var fullCanvas = createFullCanvas(image.getWidth(), image.getHeight());
        var ic = new ImageCalculator();
        var cytoplasm = fullCanvas.duplicate();
        cytoplasm = ic.run("Subtract create", cytoplasm, vessels);
        cytoplasm = ic.run("Subtract create", cytoplasm, nuclei);
        cytoplasm = ic.run("Subtract create", cytoplasm, borderVessels);
        cytoplasm.setTitle("Cytoplasm binary - " + image.getTitle());

        // Extract ROIs
        var rm = RoiManager.getInstance() || new RoiManager();
        rm.reset();

        binaryToROI(nuclei, "All Nuclei", "blue", false);
        binaryToROI(vessels, "Central Vessels", "red", false);
        if (borderVessels) {
            binaryToROI(borderVessels, "Background / Border Vessels", "black", false);
        }
        
        // Get the cytoplasm ROI
        var allCytoplasmROI = null;
        IJ.run(cytoplasm, "8-bit", "");
        IJ.run(cytoplasm, "Make Binary", "");
        IJ.run(cytoplasm, "Create Selection", "");
        IJ.run(cytoplasm, "Make Inverse", "");
        allCytoplasmROI = cytoplasm.getRoi();
        if (allCytoplasmROI) {
            rm.addRoi(allCytoplasmROI);
            var roiIndex = rm.getCount() - 1;
            rm.select(roiIndex);
            rm.runCommand("Set Fill Color", "cyan");
            rm.runCommand("Rename", "All Cytoplasm");
        }
        
        return {
            vessels: vessels,
            nuclei: nuclei,
            borderVessels: borderVessels,
            allCytoplasmROI: allCytoplasmROI
        };
    } catch (e) {
        IJ.log("Error in Tissue Processing: " + e);
        return null;
    }
}

function createVoronoiCells(image, initial_count, final_count) {
    IJ.log("Creating Voronoi cells...");
    var rm = RoiManager.getInstance();
    
    var points_imp = IJ.createImage("Points", "8-bit black", image.getWidth(), image.getHeight(), 1);
    var ip = points_imp.getProcessor();
    ip.setColor(255);
    
    for (var i = initial_count; i < final_count; i++) {
        rm.select(i);
        var roi = rm.getRoi(i);
        var bounds = roi.getBounds();
        var x = bounds.x + bounds.width/2;
        var y = bounds.y + bounds.height/2;
        ip.drawDot(Math.round(x), Math.round(y));
    }
    
    points_imp.updateAndDraw();
    
    IJ.setAutoThreshold(points_imp, "Default dark");
    IJ.run(points_imp, "Convert to Mask", "");
    IJ.run(points_imp, "Voronoi", "");
    IJ.setRawThreshold(points_imp, 1, 255, null);
    IJ.run(points_imp, "Convert to Mask", "");
    
    points_imp.show();
    
    var cellsToKeep = [];
    var nucleiToDelete = [];
    var imageWidth = image.getWidth();
    var imageHeight = image.getHeight();
    
    for (var i = initial_count; i < final_count; i++) {
        rm.select(i);
        var nucleus_roi = rm.getRoi(i);
        var bounds = nucleus_roi.getBounds();
        var x = bounds.x + bounds.width/2;
        var y = bounds.y + bounds.height/2;
        
        IJ.doWand(Math.round(x), Math.round(y));
        var cell_roi = points_imp.getRoi();
        
        if (cell_roi) {
            var cellBounds = cell_roi.getBounds();
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
    
    nucleiToDelete.sort(function(a, b) { return b - a; });
    for (var i = 0; i < nucleiToDelete.length; i++) {
        rm.select(nucleiToDelete[i]);
        rm.runCommand("Delete");
    }
    
    points_imp.changes = false;
    points_imp.hide();
    points_imp.close();
    
    return cellsToKeep;
}

function createCytoplasms(allCytoplasmROI) {
    IJ.log("Creating cytoplasms...");
    var rm = RoiManager.getInstance();
    if (!rm) {
        IJ.error("No ROI Manager open");
        return;
    }

    if (!allCytoplasmROI) {
        IJ.error("No cytoplasm ROI provided");
        return;
    }

    var nucleusIndices = {};
    var cellIndices = {};
    var maxNumber = 0;

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

    var toDelete = {cytoplasms: [], cells: [], nuclei: []};

    for (var num = 1; num <= maxNumber; num++) {
        if (nucleusIndices[num] !== undefined && cellIndices[num] !== undefined) {
            rm.select(nucleusIndices[num]);
            var nucleus_roi = new ShapeRoi(rm.getRoi(nucleusIndices[num]));
            
            rm.select(cellIndices[num]);
            var cell_roi = new ShapeRoi(rm.getRoi(cellIndices[num]));
            
            var cytoplasm_roi = cell_roi.not(nucleus_roi);
            cytoplasm_roi = cytoplasm_roi.and(new ShapeRoi(allCytoplasmROI));

            rm.addRoi(cytoplasm_roi);
            rm.select(rm.getCount() - 1);
            rm.runCommand("Set Fill Color", "pink");
            rm.runCommand("Rename", "Cytoplasm_" + num);

            var stats = cytoplasm_roi.getStatistics();
            if (stats.area == 0) {
                toDelete.cytoplasms.push(num);
                toDelete.nuclei.push(nucleusIndices[num]);
            }
            toDelete.cells.push(cellIndices[num]);
        }
    }

    // Delete in reverse order to maintain indices
    for (var i = toDelete.cells.length - 1; i >= 0; i--) {
        rm.select(toDelete.cells[i]);
        rm.runCommand("Delete");
    }
    
    for (var i = toDelete.nuclei.length - 1; i >= 0; i--) {
        rm.select(toDelete.nuclei[i]);
        rm.runCommand("Delete");
    }
    
    for (var i = toDelete.cytoplasms.length - 1; i >= 0; i--) {
        for (var j = rm.getCount() - 1; j >= 0; j--) {
            if (rm.getName(j) === "Cytoplasm_" + toDelete.cytoplasms[i]) {
                rm.select(j);
                rm.runCommand("Delete");
                break;
            }
        }
    }
}

function cellularParts(vessels, nuclei, borderVessels, allCytoplasmROI) {
    try {
        var counts = {
            vessels: 0,
            border: 0,
            nuclei: 0
        };
        
        if (ignoreBorderVessels) {
            counts.vessels = analyzeAndRenameParticles(vessels, minSizeVessels, maxSizeVessels, "Vessel", "red")[1];
            
            IJ.run(borderVessels, "8-bit", "");
            IJ.run(borderVessels, "Fill Holes", "");
            counts.border = analyzeAndRenameParticles(borderVessels, minSizeVessels, maxSizeVessels, "Border", "black")[1];
        } else {
            counts.vessels = analyzeAndRenameParticles(vessels, minSizeVessels, maxSizeVessels, "Vessel", "red")[1];
        }
        
        var nucleiCounts = analyzeAndRenameParticles(nuclei, minSizeNuclei, maxSizeNuclei, "Nucleus", "blue");
        counts.nuclei = nucleiCounts[1] - nucleiCounts[0];
        
        createVoronoiCells(nuclei, nucleiCounts[0], nucleiCounts[1]);
        createCytoplasms(allCytoplasmROI);
        
        return counts;
    } catch (e) {
        IJ.log("Error in cellular analysis: " + e);
        return null;
    }
}

// Color deconvolution and saving functions
function ColourDeconvolution(imp) {
    if (!imp) {
        IJ.error("No image provided for colour deconvolution");
        return false;
    }
    
    try {
        IJ.run(imp, "Colour Deconvolution", "vectors=H&E hide");
        var title = imp.getTitle();
        return {
            success: true,
            hematoxylinImp: WindowManager.getImage(title + "-(Colour_1)"),
            eosinImp: WindowManager.getImage(title + "-(Colour_2)"),
            thirdImp: WindowManager.getImage(title + "-(Colour_3)")
        };
    } catch (e) {
        IJ.log("Error in colour deconvolution: " + e);
        return {success: false};
    }
}

function saveROI(outputDir) {
    var rm = RoiManager.getInstance();
    if (!rm || rm.getCount() == 0) return;
    
    var roiPath = new File(outputDir, "ROIs.zip");
    rm.runCommand("Save", roiPath.getAbsolutePath());
    IJ.log("ROIs saved to: " + roiPath.getAbsolutePath());
}
function saveColouredPreview(previewDir, baseName) {
    var rm = RoiManager.getInstance();
    if (!rm || rm.getCount() < 4) {
        IJ.log("Not enough ROIs to create preview");
        return;
    }

    // Get the first image to determine dimensions
    rm.select(0);
    var roi = rm.getRoi(0);
    var bounds = roi.getBounds();
    var width = bounds.x + bounds.width;
    var height = bounds.y + bounds.height;

    // Check all ROIs to ensure canvas is large enough
    for (var i = 1; i < rm.getCount(); i++) {
        rm.select(i);
        roi = rm.getRoi(i);
        bounds = roi.getBounds();
        width = Math.max(width, bounds.x + bounds.width);
        height = Math.max(height, bounds.y + bounds.height);
    }

    // Create a new RGB image
    var imp = IJ.createImage("Coloured Preview", "RGB", width, height, 1);
    imp.show();

    // Define colors for the first 4 ROIs
    var colors = [
        new java.awt.Color(0, 0, 139),  // dark blue
        java.awt.Color.RED,             // red
        java.awt.Color.BLACK,           // black
        new java.awt.Color(255, 192, 203) // pink
    ];

    // Draw the first 4 ROIs with specified colors
    var ip = imp.getProcessor();
    for (var i = 0; i < 4 && i < rm.getCount(); i++) {
        rm.select(i);
        roi = rm.getRoi(i);
        ip.setColor(colors[i]);
        ip.fill(roi);
    }

    imp.updateAndDraw();

    // Save the preview with title prefix
    var fs = new FileSaver(imp);
    fs.saveAsPng(new File(previewDir, baseName + "_preview.png").getAbsolutePath());
    
    // Close the preview window
    imp.close();
}

function saveData(resultsFile, imp, hematoxylinImp, eosinImp, thirdImp) {
    hematoxylinImp.hide();
    eosinImp.hide();
    thirdImp.close();

    var rm = RoiManager.getInstance();
    if (!rm || rm.getCount() == 0) {
        IJ.error("No ROIs in ROI Manager");
        return;
    }

    var rt = new ResultsTable();
    var measurements = Measurements.AREA + Measurements.MEAN + Measurements.STD_DEV + 
                      Measurements.MODE + Measurements.MIN_MAX + Measurements.CENTROID + 
                      Measurements.CENTER_OF_MASS + Measurements.PERIMETER + 
                      Measurements.RECT + Measurements.ELLIPSE + 
                      Measurements.SHAPE_DESCRIPTORS + Measurements.FERET + 
                      Measurements.INTEGRATED_DENSITY + Measurements.MEDIAN + 
                      Measurements.SKEWNESS + Measurements.KURTOSIS + 
                      Measurements.AREA_FRACTION;

    var rois = rm.getRoisAsArray();
    for (var i = 0; i < rois.length; i++) {
        var roi = rois[i];
        var roiName = rm.getName(i);

        hematoxylinImp.setRoi(roi);
        var hematoxylinHistogram = hematoxylinImp.getProcessor().crop().getHistogram();
        var hematoxylinHistogramString = Java.from(hematoxylinHistogram).join(",");

        eosinImp.setRoi(roi);
        var eosinHistogram = eosinImp.getProcessor().crop().getHistogram();
        var eosinHistogramString = Java.from(eosinHistogram).join(",");

        imp.setRoi(roi);
        var stats = ImageStatistics.getStatistics(imp.getProcessor(), measurements, imp.getCalibration());

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

    rt.save(resultsFile.getAbsolutePath());
    IJ.log("Results saved to: " + resultsFile.getAbsolutePath());
}


function addValue(rt, column, value) {
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
        rt.addValue(column, "");
    } else {
        rt.addValue(column, value);
    }
}

function saveProbabilities(probabilitiesDir, stack, baseName) {
    if (!stack) {
        IJ.log("No probability stack provided");
        return;
    }

    try {
        // Define names for each probability map
        var names = ["Nuclei", "Cytoplasm", "Vessels-background"];
        
        // Save each probability map
        for (var i = 1; i <= 3; i++) {
            var probImp = new ImagePlus(names[i-1], stack.getProcessor(i));
            // Convert to 8-bit
            IJ.run(probImp, "8-bit", "");
            var fs = new FileSaver(probImp);
            var filename = baseName + "_" + names[i-1] + "_probabilities.tif";
            fs.saveAsTiff(new File(probabilitiesDir, filename).getAbsolutePath());
            IJ.log("Saved probability map " + names[i-1] + " to: " + filename);
            probImp.close();
        }
    } catch (e) {
        IJ.log("Error saving probability maps: " + e);
    }
}
function validatePaths() {
    // Check classifier file
    var classifierFile = new File(classifierPath);
    if (!classifierFile.exists()) {
        IJ.error("Classifier not found", "Classifier file not found at: " + classifierPath);
        return false;
    }
    
    // Check input folder
    var inputDir = new File(folderPath);
    if (!inputDir.exists() || !inputDir.isDirectory()) {
        IJ.error("Invalid input", "Input directory not found: " + folderPath);
        return false;
    }
    
    // Check output folder permissions
    try {
        var outputDir = new File(outputBasePath);
        if (!outputDir.exists()) {
            if (!outputDir.mkdirs()) {
                IJ.error("Permission denied", "Cannot create output directory: " + outputBasePath);
                return false;
            }
        } else {
            // Test write permission by creating/deleting temp file
            var testFile = new File(outputDir, ".test");
            if (!testFile.createNewFile()) {
                IJ.error("Permission denied", "Cannot write to output directory: " + outputBasePath);
                return false;
            }
            testFile.delete();
        }
    } catch (e) {
        IJ.error("Error", "Error checking output directory: " + e.message);
        return false;
    }
    
    return true;
}

function saveAll(imp, wekaStack, outputDir) {
    if (!imp) {
        IJ.error("No image provided");
        return;
    }
    
    var title = imp.getTitle();
    // Get filename without extension
    var baseName = title.replace(/\.[^/.]+$/, "");
    
    // Create the four main directories
    var dataDir = new File(outputDir, "Data");
    var roiDir = new File(outputDir, "ROI");
    var previewDir = new File(outputDir, "Preview");
    var probabilitiesDir = new File(outputDir, "Probabilities");
    
    // Create directories if they don't exist
    dataDir.mkdirs();
    roiDir.mkdirs();
    previewDir.mkdirs();
    probabilitiesDir.mkdirs();
    
    // Save ROIs with title prefix
    var roiPath = new File(roiDir, baseName + "_ROI.zip");
    var rm = RoiManager.getInstance();
    if (rm && rm.getCount() > 0) {
        rm.runCommand("Save", roiPath.getAbsolutePath());
        IJ.log("ROIs saved to: " + roiPath.getAbsolutePath());
    }
    
    // Save preview with title prefix
    saveColouredPreview(previewDir, baseName);
    
    // Save data with title prefix
    var resultsFile = new File(dataDir, baseName + "_data.csv");
    var deconvResult = ColourDeconvolution(imp);
    if (deconvResult.success) {
        saveData(resultsFile, imp, deconvResult.hematoxylinImp, deconvResult.eosinImp, deconvResult.thirdImp);
    }
    
    // Save probabilities with title prefix and wekaStack info
    saveProbabilities(probabilitiesDir, wekaStack, baseName);
}

function cleanup() {
    // Close any open images
    var ids = WindowManager.getIDList();
    if (ids != null) {
        for (var i = 0; i < ids.length; i++) {
            var imp = WindowManager.getImage(ids[i]);
            if (imp != null) {
                imp.changes = false;
                imp.close();
            }
        }
    }
    
    // Reset ROI Manager
    var rm = RoiManager.getInstance();
    if (rm != null) {
        rm.reset();
        rm.close();
    }
    
    // Clean up temporary files
    var tempFiles = ["Points", "Mask of Points"];
    for (var i = 0; i < tempFiles.length; i++) {
        var imp = WindowManager.getImage(tempFiles[i]);
        if (imp != null) {
            imp.changes = false;
            imp.close();
        }
    }
    
    // Close progress dialog
    progressDialog.close();
}

function mainLoop() {
    shouldStop = false;
    
    // Get user input before starting
    if (!getUserInput()) {
        return;
    }
    
    // Validate paths before starting
    if (!validatePaths()) {
        return;
    }
    
    progressDialog.initialize();
    
    try {
        var baseDir = new File(folderPath);
        processDirectory(baseDir, folderPath);
        
        var totalTime = progressDialog.formatTime(new Date().getTime() - progressDialog.startTime);
        if (shouldStop) {
            progressDialog.showStatus("\nAnalysis stopped by user after " + totalTime + "!");
        } else {
            progressDialog.showStatus("\nAnalysis completed for all images in " + totalTime + "!");
        }
    } catch (e) {
        IJ.log("Error in main loop: " + e);
        progressDialog.showStatus("\nError occurred: " + e);
    } finally {
        cleanup();
    }
}

mainLoop();