/// <reference path="../typescript_definitions/index.d.ts" />

class TopReader extends FileReader{
    topFile: File = null;
    system: System;
    elems: ElementMap;

    sidCounter = 0;
    nucLocalID: number = 0;
    lastStrand: number; //strands are 1-indexed in oxDNA .top files
    n3: number;
    callback : Function;
    configurationLength : number;

    constructor(topFile: File, system: System, elems: ElementMap, callback : Function){
        super();
        this.topFile = topFile;
        this.system = system;
        this.elems = elems;
        this.callback = callback;

    }
    onload = ((f) => {
        return () => {
            let nucCount = this.elems.getNextId();
            let file = this.result as string
            let lines = file.split(/[\n]+/g);
            lines = lines.slice(1); // discard the header
            this.configurationLength = lines.length;

            let l0 = lines[0].split(" "); 
            let strID = parseInt(l0[0]); //proteins are negative indexed
            this.lastStrand = strID;
            let currentStrand: Strand = this.system.createStrand(strID);
            this.system.addStrand(currentStrand);
            
            // create empty list of elements with length equal to the topology
            // Note: this is implemented such that we have the elements for the DAT reader 
            let nuc: BasicElement;//DNANucleotide | RNANucleotide | AminoAcid;
            for (let j = 0; j < lines.length; j++) {
                this.elems.set(nucCount+j, nuc);
            } 
            
            lines.forEach((line, i) => {
                if (line == "") {
                    // Delete last element
                    this.elems.delete(this.elems.getNextId()-1);
                    return;
                }
                //split the file and read each column, format is: "strID base n3 n5"
                let l = line.split(" "); 
                strID = parseInt(l[0]);
                    
                if (strID != this.lastStrand) { //if new strand id, make new strand                        
                    currentStrand = this.system.createStrand(strID);
                    this.system.addStrand(currentStrand);
                    this.nucLocalID = 0;
                };
                    
                //create a new element
                if (!this.elems.get(nucCount + i))
                    this.elems.set(nucCount + i, currentStrand.createBasicElement(nucCount + i));
                let nuc = this.elems.get(nucCount + i);

                // Set systemID
                nuc.sid = this.sidCounter++;
                    
                //create neighbor 3 element if it doesn't exist
                let n3 = parseInt(l[2]);
                if (n3 != -1) {
                    if (!this.elems.get(nucCount + n3)) {
                        this.elems.set(nucCount + n3, currentStrand.createBasicElement(nucCount + n3));
                    }
                    nuc.n3 = this.elems.get(nucCount + n3);
                }
                else {
                    nuc.n3 = null;
                    currentStrand.end3 = nuc;
                }

                //create neighbor 5 element if it doesn't exist
                let n5 = parseInt(l[3]);
                if (n5 != -1) {
                    if (!this.elems.get(nucCount + n5)) {
                        this.elems.set(nucCount + n5, currentStrand.createBasicElement(nucCount + n5));
                    }
                    nuc.n5 = this.elems.get(nucCount + n5);
                }
                else {
                    nuc.n5 = null;
                    currentStrand.end5 = nuc;
                }

                let base = l[1]; // get base id
                nuc.type = base;
                //if we meet a U, we have an RNsibleA (its dumb, but its all we got)
                //this has an unfortunate side effect that the first few nucleotides in an RNA strand are drawn as DNA (before the first U)
                if (base === "U") RNA_MODE = true;
                    
                this.nucLocalID += 1;
                this.lastStrand = strID;
            });
            nucCount = this.elems.getNextId();
            // usually the place where the DatReader gets fired
            this.callback();
        }})(this.topFile);
    
    read(){
        this.readAsText(this.topFile);
    }
}

class FileChunker{
    file:Blob;
    current_chunk : number;
    chunk_size : number;
    constructor(file: Blob, chunk_size: number){
        this.file = file;
        this.chunk_size = chunk_size;
        this.current_chunk = 0;
    }
    get_next_chunk(){
        if(!this.is_last())
            this.current_chunk++;
        return this.get_chunk();
    }
    get_prev_chunk(){
        this.current_chunk--;
        if(this.current_chunk <= 0) this.current_chunk = 0;
        return this.get_chunk();
    }
    is_last(){
        if(this.current_chunk * this.chunk_size + this.chunk_size >= this.file.size)
            return true;
        return false;
    }
    private get_chunk(){
        return this.file.slice(
            this.current_chunk * this.chunk_size,
            this.current_chunk * this.chunk_size + this.chunk_size
        );
    }
 }

 //markers are used by the trajectory reader to keep track of configuration start/ends
class marker {
    chunk: String;
    lineID: number;
}

class DatReader extends FileReader {
    topReader : TopReader;
    system : System;
    elems : ElementMap;
    chunker : FileChunker;
    datFile: File;
    confLength : number;
    curConf : string[];
    leftoverConf : string[];

    constructor(datFile:File, topReader: TopReader, system: System, elems: ElementMap){
        super();
        this.topReader = topReader;
        this.system = system;
        this.elems = elems;
        this.datFile = datFile;
        this.chunker = new FileChunker(datFile, topReader.topFile.size * 30);
        this.confLength = this.topReader.configurationLength +3; //TODO: messed up, figure out 
        this.leftoverConf = [];
        this.curConf= [];
    }

    onload = ((f)=>{
        return () => {
            let file = this.result as string

            if (file == "") {
                document.dispatchEvent(new Event('finalConfig'));
                return;
            }
            let lines = file.split(/[\n]+/g);
            this.curConf.push(...lines);
            //console.log("bla:",lines.length)

            // we have to little, need to get more 
            if(this.curConf.length < this.confLength){
                this.readAsText(this.chunker.get_next_chunk());
                return; // do the game again ;0)
            }
            // now make sure we have the right ammount of stuff in curConf
            this.leftoverConf = this.curConf.slice(this.confLength);
            //now fire off parsing 
            this.parse_conf();
        }
    })();


    parse_conf(){
        let system = this.system;
        let currentStrand = system.strands[0];
        let numNuc = system.systemLength();
        // parse file into lines
        let lines = this.curConf;
        if (lines.length-3 < numNuc) { //Handles dat files that are too small.  can't handle too big here because you don't know if there's a trajectory
            notify(".dat and .top files incompatible", "alert");
            return
        }
        // Increase the simulation box size if larger than current
        box.x = Math.max(box.x, parseFloat(lines[1].split(" ")[2]));
        box.y = Math.max(box.y, parseFloat(lines[1].split(" ")[3]));
        box.z = Math.max(box.z, parseFloat(lines[1].split(" ")[4]));
        redrawBox();
    
        const time = parseInt(lines[0].split(" ")[2]);
        confNum += 1
        console.log(confNum, "t =", time);
        let timedisp = document.getElementById("trajTimestep");
        timedisp.innerHTML = `t = ${time.toLocaleString()}`;
        timedisp.hidden = false;
        // discard the header
        lines = lines.slice(3);
        
        let currentNucleotide: BasicElement,
            l: string[];
        //for each line in the current configuration, read the line and calculate positions
        for (let i = 0; i < numNuc; i++) {
            if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
                break
            };
            // get the nucleotide associated with the line
            currentNucleotide = elements.get(i+system.globalStartId);
    
            // consume a new line from the file
            l = lines[i].split(" ");
            currentNucleotide.calcPositionsFromConfLine(l, true);
    
            //when a strand is finished, add it to the system
            if (!currentNucleotide.n5 || currentNucleotide.n5 == currentStrand.end3) { //if last nucleotide in straight strand
                if (currentNucleotide.n5 == currentStrand.end3) {
                    currentStrand.end5 = currentNucleotide;
                }
                system.addStrand(currentStrand); // add strand to system
                currentStrand = system.strands[currentStrand.id];//strandID]; //don't ask, its another artifact of strands being 1-indexed
                if (elements.get(currentNucleotide.id+1)) {
                    currentStrand = elements.get(currentNucleotide.id+1).strand;
                }
            }
    
        }
        addSystemToScene(system);
        centerAndPBC(system.getMonomers());
        sysCount++;
    
        //if there's another time line after the first configuration is loaded, its a trajectory
        if (lines[numNuc].slice(0, 1) == 't')
            return true;
        return false;
    }
    //onload = ((f) => {
    //    return () => {
    //    //let's rewrite the logic a bit...
//
    //    let system = this.system;
    //    let currentStrand = system.strands[0];
    //    let numNuc = system.systemLength();
    //    // parse file into lines
    //    let lines = (<string> this.result).split(/[\n]+/g);
    //    if (lines.length-3 < numNuc) { //Handles dat files that are too small.  can't handle too big here because you don't know if there's a trajectory
    //        notify(".dat and .top files incompatible", "alert");
    //        return
    //    }
    //    // Increase the simulation box size if larger than current
    //    box.x = Math.max(box.x, parseFloat(lines[1].split(" ")[2]));
    //    box.y = Math.max(box.y, parseFloat(lines[1].split(" ")[3]));
    //    box.z = Math.max(box.z, parseFloat(lines[1].split(" ")[4]));
    //    redrawBox();
    //
    //    const time = parseInt(lines[0].split(" ")[2]);
    //    confNum += 1
    //    console.log(confNum, "t =", time);
    //    let timedisp = document.getElementById("trajTimestep");
    //    timedisp.innerHTML = `t = ${time.toLocaleString()}`;
    //    timedisp.hidden = false;
    //    // discard the header
    //    lines = lines.slice(3);
    //    
    //    let currentNucleotide: BasicElement,
    //        l: string[];
    //
    //    //for each line in the current configuration, read the line and calculate positions
    //    for (let i = 0; i < numNuc; i++) {
    //        if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
    //            break
    //        };
    //        // get the nucleotide associated with the line
    //        currentNucleotide = elements.get(i+system.globalStartId);
    //
    //        // consume a new line from the file
    //        l = lines[i].split(" ");
    //        currentNucleotide.calcPositionsFromConfLine(l, true);
    //
    //        //when a strand is finished, add it to the system
    //        if (!currentNucleotide.n5 || currentNucleotide.n5 == currentStrand.end3) { //if last nucleotide in straight strand
    //            if (currentNucleotide.n5 == currentStrand.end3) {
    //                currentStrand.end5 = currentNucleotide;
    //            }
    //            system.addStrand(currentStrand); // add strand to system
    //            currentStrand = system.strands[currentStrand.id];//strandID]; //don't ask, its another artifact of strands being 1-indexed
    //            if (elements.get(currentNucleotide.id+1)) {
    //                currentStrand = elements.get(currentNucleotide.id+1).strand;
    //            }
    //        }
    //
    //    }
    //    addSystemToScene(system);
    //    centerAndPBC(system.getMonomers());
    //    sysCount++;
    //
    //    //if there's another time line after the first configuration is loaded, its a trajectory
    //    if (lines[numNuc].slice(0, 1) == 't')
    //        return true;
    //    return false;
    //}})();

    get_next_conf(){
        this.readAsText(
            this.chunker.get_next_chunk()
        );
    }

}






class TrajectoryReader {
    datFile: File;
    system: System;
    approxDatLen;
    nextReader: FileReader;
    previousReader: FileReader;
    currentChunkNumber: number;
    previousPreviousChunk: String; //Space to store the chunks
    previousChunk: String;
    currentChunk: String;
    nextChunk: String;
    ppHangingLine: string; //Deal with bad linebreaks caused by splitting the trajectory bitwise
    pHangingLine: string;
    cHangingLine: string;
    nHangingLine: string;
    confBegin: marker;
    confEnd: marker;
    confLen: number;
    time: number;

    // Create the readers and read the second chunk
    constructor(datFile, system, approxDatLen, currentChunk){
        this.datFile = datFile;
        this.system = system;
        this.approxDatLen = approxDatLen;
        this.nextReader = new FileReader();
        this.previousReader = new FileReader();
        this.currentChunkNumber = 0;
        this.currentChunk = currentChunk;
        this.confBegin = new marker;
        this.confEnd = new marker;
        this.createReadHandlers();
    
        const nextChunkBlob = datChunker(this.datFile, 1, this.approxDatLen);
        this.nextReader.readAsText(nextChunkBlob);

        const numNuc = system.systemLength();
        this.confLen = numNuc + 3;

        this.confBegin.chunk = currentChunk;
        this.confBegin.lineID = 0;

        this.confEnd.chunk = currentChunk;
        this.confEnd.lineID = numNuc + 2; //end of current configuration
    }

    createReadHandlers() {
        //chunking bytewise often leaves incomplete lines, so cut off the beginning of the new chunk and append it to the chunk before
        this.nextReader.onload = () => {
            this.nextChunk = this.nextReader.result as String;
            if (this.nextChunk == "") {
                document.dispatchEvent(new Event('finalConfig'));
                return;
            }
            this.nHangingLine = "";
            let c = "";
            for (c = this.nextChunk.slice(0, 1); c != '\n'; c = this.nextChunk.slice(0, 1)) {
                this.nHangingLine += c;
                this.nextChunk = this.nextChunk.substring(1);
            }
            try {
                this.currentChunk = this.currentChunk.concat(this.nHangingLine);
            }
            catch (error) {
                console.log("File readers got all topsy-turvy, traj reading may not work :( \n")
                console.log(error);
            }
            this.nextChunk = this.nextChunk.substring(1);
            this.confEnd.chunk = this.currentChunk;
        
            // Signal that config has been loaded
            // block the nextConfig loaded to prevent the video loader from continuing after the chunk
            document.dispatchEvent(new Event('nextConfigLoaded'));
        };

        //same as the above declaration, but this doesn't have anywhere to put the cut string, so it just holds it.
        this.previousReader.onload = () => {
            this.previousPreviousChunk = this.previousReader.result as String;
            if (this.previousPreviousChunk == "") { return }
            this.ppHangingLine = "";
            let c = "";
            for (c = this.previousPreviousChunk.slice(0, 1); c != '\n'; c = this.previousPreviousChunk.slice(0, 1)) {
                this.ppHangingLine += c;
                this.previousPreviousChunk = this.previousPreviousChunk.substring(1);
            }
            this.previousPreviousChunk = this.previousPreviousChunk.substring(1);
            this.previousPreviousChunk = this.previousPreviousChunk.concat(this.pHangingLine);
            this.confEnd.chunk = this.currentChunk;
        
            // Signal that config has been loaded
            document.dispatchEvent(new Event('nextConfigLoaded'));
        };
            }
        
    extractNextConf() {
        let needNextChunk: boolean = false;
        const currentChunkLines: string[] = this.currentChunk.split(/[\n]+/g);
        const nextChunkLines: string[] = this.nextChunk.split(/[\n]+/g);
        const currentChunkLength: number = currentChunkLines.length;
        const nextConf: string[] = [];
        const start = new marker;
        if (nextChunkLines[0] == "") {
            return undefined
        }
        if (this.confEnd.lineID != currentChunkLength-1) { //handle very rare edge case where conf ended exactly at end of chunk
            start.chunk = this.confEnd.chunk;
            start.lineID = this.confEnd.lineID + 1;
        }
        else {
            start.chunk = this.nextChunk;
            start.lineID = 0;
            needNextChunk = true;
        }
        const end = new marker;
        if (start.lineID + this.confLen < currentChunkLength) { //is the whole conf in a single chunk?
            end.chunk = start.chunk;
            end.lineID = start.lineID + this.confLen - 1;
            for (let i = start.lineID; i < end.lineID + 1; i++) {
                if (currentChunkLines[i] == "" || currentChunkLines == undefined) { return undefined }
                nextConf.push(currentChunkLines[i]);
            }
        }
        else {
            end.chunk = this.nextChunk;
            end.lineID = this.confLen - (currentChunkLength - start.lineID) - 1;
            needNextChunk = true
            for (let i = start.lineID; i < currentChunkLength; i++) {
                if (currentChunkLines[i] == "" || currentChunkLines == undefined) { return undefined }
                nextConf.push(currentChunkLines[i]);
            }
            for (let i = 0; i < end.lineID + 1; i++) {
                nextConf.push(nextChunkLines[i]);
            }
        }
        this.confBegin = start;
        this.confEnd = end;
        if (needNextChunk) {
            this.getNextChunk(this.currentChunkNumber + 2); //current is the old middle, so need two ahead
        }
        return (nextConf);
    }
    
    extractPreviousConf() {
        let needPreviousChunk: boolean = false;
        const previousConf: string[] = []
        const end = new marker;
        let endChunkLines: string[]
        if (confNum == 1) { //can't go backwards from 1
            return undefined
        }
        else if (this.confBegin.lineID != 0) { //handle rare edge case where a conf began at the start of a chunk
            end.chunk = this.confBegin.chunk;
            if (end.chunk == this.previousChunk) {
                needPreviousChunk = true;
            }
            end.lineID = this.confBegin.lineID - 1;
            endChunkLines = end.chunk.split(/[\n]+/g);
        }
        else {
            end.chunk = this.previousChunk;
            endChunkLines = end.chunk.split(/[\n]+/g);
            end.lineID = endChunkLines.length - 1;
            needPreviousChunk = true;
        }
         
    
        const start = new marker;
        if (end.lineID - this.confLen >= -1) { //is the whole conf in a single chunk?
            start.chunk = end.chunk;
            start.lineID = end.lineID - this.confLen + 1;
            const startChunkLines: string[] = start.chunk.split(/[\n]+/g);
            for (let i = start.lineID; i < end.lineID + 1; i++) {
                if (startChunkLines[i] == "" || startChunkLines == undefined) { return undefined }
                previousConf.push(startChunkLines[i]);
            }
        }
        else {
            if (end.chunk == this.currentChunk && confNum != 2) {
                start.chunk = this.previousChunk;
            }
            else if (end.chunk == this.previousChunk && confNum != 2) {
                start.chunk = this.previousPreviousChunk;
            }
            else {
                start.chunk = this.previousChunk;
            }
            const startChunkLines: string[] = start.chunk.split(/[\n]+/g);
            start.lineID = startChunkLines.length - (this.confLen - (end.lineID + 1));
            for (let i = start.lineID; i < startChunkLines.length; i++) {
                if (startChunkLines[i] == "" || startChunkLines[i] == undefined) { return undefined }
                previousConf.push(startChunkLines[i]);
            }
            for (let i = 0; i < end.lineID + 1; i++) {
                if (endChunkLines[i] == "" || endChunkLines[i] == undefined) { return undefined }
                previousConf.push(endChunkLines[i]);
            }
        }
        this.confBegin = start;
        this.confEnd = end;
        if (needPreviousChunk) {
            this.getPreviousChunk(this.currentChunkNumber - 3);
        }
        return (previousConf);
    }
    
    getNextChunk(chunkNumber) {
        this.previousPreviousChunk = this.previousChunk;
        this.ppHangingLine = this.pHangingLine;
        this.previousChunk = this.currentChunk;
        this.pHangingLine = this.cHangingLine;
        this.currentChunk = this.nextChunk;
        this.cHangingLine = this.nHangingLine;
    
        const nextChunkBlob = datChunker(datFile, chunkNumber, this.approxDatLen);
        this.nextReader.readAsText(nextChunkBlob);
        this.currentChunkNumber += 1;
    }
    
    getPreviousChunk(chunkNumber) {
        this.nextChunk = this.currentChunk;
        this.nHangingLine = this.cHangingLine;
        this.currentChunk = this.previousChunk;
        this.cHangingLine = this.pHangingLine;
        this.previousChunk = this.previousPreviousChunk;
        this.pHangingLine = this.ppHangingLine;
    
        if (chunkNumber  < 0) {
            if (this.previousPreviousChunk != undefined) {
                this.previousPreviousChunk = undefined;
                if (this.ppHangingLine) {
                    if (this.confBegin.chunk == this.previousChunk) {
                        this.confBegin.chunk = this.ppHangingLine+"\n"+this.previousChunk;
                        this.confBegin.lineID += 1;
                    }
                    this.previousChunk = this.ppHangingLine+"\n"+this.previousChunk;
                }
            }
            //else {
            //    this.previousChunk = undefined;
            //}
            this.currentChunkNumber -= 1;
            return
        }
    
        const previousPreviousChunkBlob = datChunker(this.datFile, chunkNumber, this.approxDatLen);
        this.previousReader.readAsText(previousPreviousChunkBlob);
        this.currentChunkNumber -= 1
    }

    getNewConfig(mode) { //attempts to display next configuration
        if (systems.length > 1) {
            notify("Only one file at a time can be read as a trajectory, sorry...");
            return;
        }
        for (let i = 0; i < systems.length; i++) { //for each system - does not actually work for multiple systems...but maybe one day
            const system = this.system;
            const numNuc: number = system.systemLength(); //gets # of nuc in system
            let lines;
            if (mode == 1) {
                lines = this.extractNextConf()
                confNum += mode
            }
            if (mode == -1) {
                lines = this.extractPreviousConf()
                confNum += mode;
            }
            if (lines == undefined || lines[0] == "" || lines[0] == undefined) {
                notify("No more confs to load!");
                confNum -= mode;
                return;
            }
    
            //get the simulation box size
            this.time = parseInt(lines[0].split(" ")[2]);
            console.log(confNum, 't =', this.time);
            let timedisp = document.getElementById("trajTimestep");
            timedisp.innerHTML = `t = ${this.time.toLocaleString()}`;
            timedisp.hidden = false;
            // discard the header
            lines = lines.slice(3);
            let currentNucleotide: BasicElement,
                l: string[];
    
            for (let lineNum = 0; lineNum < numNuc; lineNum++) {
                if (lines[lineNum] == "") {
                    notify("There's an empty line in the middle of your configuration!")
                    break
                };
                currentNucleotide = elements.get(systems[i].globalStartId+lineNum);
                // consume a new line
                l = lines[lineNum].split(" ");
                currentNucleotide.calcPositionsFromConfLine(l);
            }
    
            system.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
            system.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
            system.nucleoside.geometry["attributes"].instanceRotation.needsUpdate = true;
            system.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
            system.connector.geometry["attributes"].instanceRotation.needsUpdate = true;
            system.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
            system.bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
            system.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
            system.dummyBackbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        }
        centerAndPBC();
        render();
        document.dispatchEvent(new Event('nextConfigLoaded'));
    }
    nextConfig() {
        if (this.nextReader.readyState == 1) { //0: nothing loaded 1: working 2: done
            return;
        }
        this.getNewConfig(1);
        if (forceHandler) forceHandler.update();
    };
    
    previousConfig() {
        if (this.previousReader.readyState == 1 || confNum == 1) {
            return;
        }
        this.getNewConfig(-1);
        if (forceHandler) forceHandler.update();
    };

    /**
     * Step through trajectory until a specified timestep
     * is found
     * @param timeLim Timestep to stop at
     * @param backwards Step backwards
     */
    stepUntil(timeLim: number, backwards: boolean) {
        let icon = document.getElementById(
            backwards ? 'trajPrevUntilIco' : 'trajNextUntilIco'
        );
        if (icon.classList.contains('mif-pause')) {
            // If we're already running, abort!
            icon.classList.replace('mif-pause', backwards ? 'mif-previous' : 'mif-next');
            return;
        }
        // Set icon to enable pausing
        icon.classList.remove('mif-previous', 'mif-next');
        icon.classList.add('mif-pause');

        // Define loop, for requestAnimationFrame
        let loop = () => {
            if (icon.classList.contains('mif-pause') && ( // If user has clicked pause
               !this.time || // Or we don't know the current timestep
               // Or if we have stepped too far:
               backwards && this.previousChunk && (this.time > timeLim) ||
               !backwards && this.nextChunk && ((timeLim < 0) || this.time < timeLim)))
            {
                // Take one step
                if (backwards) {
                    this.previousConfig();
                } else {
                    this.nextConfig();
                }
                requestAnimationFrame(loop);
            } else {
                // When finished, change icon back from pause
                icon.classList.remove('mif-pause');
                icon.classList.add(backwards ? 'mif-previous' : 'mif-next');
            }
        }
        loop(); // Actually call the function
    }
}