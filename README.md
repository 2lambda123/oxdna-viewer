[Try it!](https://sulcgroup.github.io/oxdna-viewer/)

# oxdna-viewer

![oxdna-viewer interface](img/editing.gif)

A browser-based visualization tool that uses the [Three.js](https://threejs.org/) JavaScript library to create a smooth, seamless oxDNA configuration viewing and editing experience, even for very large configuration files (current record is 1.6 million nucleotides). To begin, either hit the "Try it" link above, or clone the repository and open index.html in a browser window. To use, simply drag and drop a topology and configuration/trajectory file pair into the browser window. If you have JSON overlay files, they can be dragged in together with the topology and configuration, or dragged separately later. 

---

## Editing Features  
The viewer can load multiple structures at the same time. You can then select and drag components around through the "Select" and "Drag" options in the sidebar. Selected components can also be rotated around the x,y and z axis. Edits can be undone and redone using ctrl-z/ctrl-y or the ![undo](https://fonts.gstatic.com/s/i/materialicons/undo/v1/24px.svg) and ![redo](https://fonts.gstatic.com/s/i/materialicons/redo/v1/24px.svg) buttons. To download your edited and now perfectly assembled structure, click the "Download Output Files" button.  Note that this new file now represents a single structure and will behave as a single system if re-loaded into the viewer.  Editing of topology (breaking strands, creating new nucleotides, joining strands together) is coming.  Watch this space for updates.

---

## Video Options  
If you would like to make a video of a trajectory, load a trajectory and click the "Create Video" button.  This will open an interactive panel where you can choose video type and output format.  

### Video types  
**Trajectory**: Will run through the provided trajectory, saving every configuration as a frame.  Will play back at the provided frame rate.  If you want to stop the capture early, click the "Stop" button and the video will download as-is.  If the camera is moved during trajectory capture this will appear in the final video, allowing you to easily show different angles.  
**Lemniscate**: The camera will make a figure-8 around the structure at the current distance, creating a 360° view of the currently loaded configuration.

### Output Formats
**Webm**: The preferred type for most modern video players, though note that older versions of PowerPoint do not play nice with it. If this is an issue, either save a Gif or convert the Webm to a different format using other software (note that this will not work in Firefox).  
**Gif**: Larger file size, but highly portable (note that this will not work in Chrome while running locally).  
**PNG/JPEG**: Will download a .zip file with every frame saved as a image of the specified type.  Can be converted to video formats using other software such as ffmpeg or ImageJ.

---

## Console Commands
In addition to the visualization and editing features highlighted in the sidebar, there is a browser console-based text API with the following functions:  
 * `toggle_strand(<strand object>)`: Toggles visibility of the given strand.  
 * `mark_strand(<strand object>)`: Highlight the given strand.  
 * `get_sequence(<strand object>)`: Returns the sequence of the given strand.  
 * `count_strand_length(optional(<system object>))`: Returns a dictionary of strand indices with their associated length. If no system is provided, defaults to the first system loaded into the scene.  Very useful for finding the id of the scaffold strand in an origami.  
 * `hilight5ps(optional(<system object>))`: Highlights the 5' ends of every strand in the given system. If no system is provided, defaults to the first system loaded into the scene.  
 * `toggle_all(optional(<system object>))`: Toggles visibility of the given system. If no system is provided, defaults to the first system loaded into the scene.  
 * `toggle_base_colors()`: Toggles the bases between type-defined colors (A = blue, T/U = red, G = yellow, C = green) and grey.  
 * `trace_53(<monomer object>)`: Returns an array of nucleotides beginning with the provided nucleotide and proceeding 5'-3' down the strand. (Remember that oxDNA files are 3'-5').  
 * `remove_colorbar()`: Hide the colorbar if an overlay is loaded.  
 * `show_colorbar()`: Show the colorbar if an overlay is loaded and the colorbar was previously hidden.  
 * `changeColormap(<map name>)`: Change the color map used for data overlays. All full-sized [Matplotlib colormaps](https://matplotlib.org/3.1.1/gallery/color/colormap_reference.html) are available in addition to the Three.js defaults ('rainbow', 'cooltowarm', 'blackbody', and 'grayscale').  Default is cooltowarm.  
 * `sp_only()`: remove all objects from the scene except the backbone cyllinders.  Creates an effect similar to licorice display options in other molecular viewers.  
 * `show_verything()`: Resets all visibility parameters to default values.  

Note that many of these require system, strand or nucleotide objects. The viewer has a simple object hierarchy where systems are made of strands which are made of elements. Arrays in JavaScript are 0-indexed, so to access the 2nd nucleotide of the 6th strand in the 1st system, you would type systems[0][strands][5][monomers][1].  There is also an array of all monomers indexed by global id, so the 1000th monomer can be accessed by elements[999].

---

## Rigid Body Simulations  
CaDNAno files exported to oxDNA using [conversion tools](http://tacoxdna.sissa.it/) will be planar and near impossible to relax using the usual relaxation methods in oxDNA. This software includes a rigid-body simulator that attempts to automatically rearrange these flat CaDNAno designs to a configuration that can be relaxed using traditional molecular dynamics methods.

To use, first click on the "Cluster" options button (![clusterOptions](https://fonts.gstatic.com/s/i/materialicons/tune/v1/24px.svg)) under the "Selection Mode" header in the sidebar. This will bring up a UI for selecting clusters. Either allow the software to automatically choose clusters using a DBSCAN algorithm (works quite well for most CaDNAno designs), or select them yourself. Once clusters are defined, click the "Rigid cluster dynamics" checkbox to initiate simulation.  Click it again to stop.  You can drag clusters around during simulation to help the relaxation along or correct topological inaccuracies by switching to drag mode.

---

## Updates and writing your own extensions
This software is still in active development, so features remain in high flux.  If you would like to make a feature request or to report a bug, please let us know in the Issues tab!  Remember to pull often if you're running the viewer locally to get the newest features.

If you want to extend the code for your own purposes, you will also need to install Typescript, Three.js and Typescript bindings for Three.  Full download instructions:

1) "git clone -b master https://github.com/sulcgroup/oxdna-viewer.git"  
2) Download Typescript and Node.js 
   ts and npm ask for different name of node.js: one is node and another is nodejs, you may need to change the name of it accordingly or get an extra copy  
3) "npm install --save @types/three"  
   If it goes wrong, open the package.json file and change "name", into "types/three-test" and try again  
   Refer to https://thisdavej.com/node-newbie-error-npm-refusing-to-install-package-as-a-dependency-of-itself  
4) Go to oxdna-viewer folder  
5) npm install --save @types/webvr-api  
   These previous two steps install the necessary Typescript bindings for Three.js  
6) tsc  
   This is the command to run the typescript compiler.  Output directory and adding new files to the compiler can be found in tsconfig.json  
   tsc needs to be run every time you make changes to the Typescript.  If you run tsc with the -w flag it will continuously watch for file changes.  
7) The compiled Javascript will be in the dist/ directory  
8) Open index.html in any browser (Chrome works best)
